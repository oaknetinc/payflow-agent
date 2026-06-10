import fs from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  http,
  keccak256,
  parseEther,
  parseUnits,
  stringToHex,
  zeroAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

function loadEnv(path) {
  const values = {};
  for (const line of fs.readFileSync(path, "utf8").split(/\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [name, ...rest] = line.split("=");
    let value = rest.join("=").trim();
    try {
      value = JSON.parse(value);
    } catch {}
    values[name] = value;
  }
  return values;
}

const env = {
  ...loadEnv(process.env.PAYFLOW_ENV_FILE ?? "/tmp/payflow-worker.env"),
  ...process.env,
};
const requesterKey = env.AGENT_PRIVATE_KEY;
const workerKey = env.AUTONOMOUS_WORKER_PRIVATE_KEY;
if (!requesterKey || !workerKey) throw new Error("Wallet keys are required.");

const requester = privateKeyToAccount(requesterKey);
const worker = privateKeyToAccount(workerKey);
const rpc = env.CELO_RPC_URL ?? env.NEXT_PUBLIC_CELO_RPC_URL;
const factory = env.NEXT_PUBLIC_AGENT_FACTORY_ADDRESS;
const registry = env.NEXT_PUBLIC_INVOICE_REGISTRY_ADDRESS;
const router = env.NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS;
const marketplace = env.NEXT_PUBLIC_JOB_MARKETPLACE_ADDRESS;
const verifier = env.NEXT_PUBLIC_INVOICE_JOB_VERIFIER_ADDRESS;
const usdc = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
if (!rpc || !factory || !registry || !router || !marketplace || !verifier) {
  throw new Error("Payflow deployment configuration is incomplete.");
}

const transport = http(rpc);
const publicClient = createPublicClient({ chain: celo, transport });
const requesterClient = createWalletClient({
  account: requester,
  chain: celo,
  transport,
});
const workerClient = createWalletClient({
  account: worker,
  chain: celo,
  transport,
});

const factoryAbi = [
  {
    name: "agentOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "agent", type: "address" }],
  },
  {
    name: "createAgent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "reminderDelay", type: "uint32" },
    ],
    outputs: [{ name: "agent", type: "address" }],
  },
];
const tokenAbi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];
const registryAbi = [
  {
    name: "createInvoice",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "dueAt", type: "uint64" },
      { name: "metadata", type: "string" },
    ],
    outputs: [],
  },
];
const requestComponents = [
  { name: "token", type: "address" },
  { name: "reward", type: "uint256" },
  { name: "acceptanceDeadline", type: "uint64" },
  { name: "workDeadline", type: "uint64" },
  { name: "reviewPeriod", type: "uint64" },
  { name: "verificationMode", type: "uint8" },
  { name: "verifier", type: "address" },
  { name: "resolver", type: "address" },
  { name: "specificationHash", type: "bytes32" },
  { name: "metadataURI", type: "string" },
];
const marketplaceAbi = [
  {
    name: "jobCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "postJob",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "requester", type: "address" },
      { name: "request", type: "tuple", components: requestComponents },
    ],
    outputs: [{ name: "jobId", type: "uint256" }],
  },
  {
    name: "fundJob",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
];

async function wait(hash) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Transaction ${hash} failed.`);
  return hash;
}

const transactions = {};
transactions.fundGas = await wait(
  await requesterClient.sendTransaction({
    to: worker.address,
    value: parseEther("0.02"),
  }),
);
transactions.fundUsdc = await wait(
  await requesterClient.writeContract({
    address: usdc,
    abi: tokenAbi,
    functionName: "transfer",
    args: [worker.address, parseUnits("0.012", 6)],
    type: "legacy",
  }),
);

let workerAgent = await publicClient.readContract({
  address: factory,
  abi: factoryAbi,
  functionName: "agentOf",
  args: [worker.address],
});
if (workerAgent === zeroAddress) {
  transactions.createAgent = await wait(
    await workerClient.writeContract({
      address: factory,
      abi: factoryAbi,
      functionName: "createAgent",
      args: ["Payflow Autonomous Worker", 86400],
      type: "legacy",
    }),
  );
  workerAgent = await publicClient.readContract({
    address: factory,
    abi: factoryAbi,
    functionName: "agentOf",
    args: [worker.address],
  });
}

const invoiceKey = keccak256(
  stringToHex(
    `payflow-autonomous-demo:${requester.address}:${worker.address}:${Date.now()}`,
  ),
);
transactions.createInvoice = await wait(
  await requesterClient.writeContract({
    address: registry,
    abi: registryAbi,
    functionName: "createInvoice",
    args: [
      invoiceKey,
      requester.address,
      usdc,
      parseUnits("0.01", 6),
      BigInt(Math.floor(Date.now() / 1000) + 86400),
      JSON.stringify({
        externalId: "PF-AUTONOMOUS-DEMO",
        client: "Payflow Worker Agent",
        description: "Autonomous invoice settlement proof",
        currency: "USDC",
      }),
    ],
    type: "legacy",
  }),
);

const metadata = {
  title: "Settle a Payflow invoice autonomously",
  description:
    "Discover this job, pay the attached 0.01 USDC invoice, and submit onchain proof without human signing.",
  category: "Agent payments",
  currency: "USDC",
  invoiceKey,
};
const now = Math.floor(Date.now() / 1000);
transactions.postJob = await wait(
  await requesterClient.writeContract({
    address: marketplace,
    abi: marketplaceAbi,
    functionName: "postJob",
    args: [
      requester.address,
      {
        token: usdc,
        reward: parseUnits("0.02", 6),
        acceptanceDeadline: BigInt(now + 86400),
        workDeadline: BigInt(now + 172800),
        reviewPeriod: BigInt(86400),
        verificationMode: 1,
        verifier,
        resolver: zeroAddress,
        specificationHash: keccak256(
          encodeAbiParameters([{ type: "bytes32" }], [invoiceKey]),
        ),
        metadataURI: `data:application/json,${encodeURIComponent(
          JSON.stringify(metadata),
        )}`,
      },
    ],
    type: "legacy",
  }),
);
const jobId = Number(
  await publicClient.readContract({
    address: marketplace,
    abi: marketplaceAbi,
    functionName: "jobCount",
  }),
);
transactions.approveEscrow = await wait(
  await requesterClient.writeContract({
    address: usdc,
    abi: tokenAbi,
    functionName: "approve",
    args: [marketplace, parseUnits("0.02", 6)],
    type: "legacy",
  }),
);
transactions.fundJob = await wait(
  await requesterClient.writeContract({
    address: marketplace,
    abi: marketplaceAbi,
    functionName: "fundJob",
    args: [BigInt(jobId)],
    type: "legacy",
  }),
);

console.log(
  JSON.stringify(
    {
      requester: requester.address,
      worker: worker.address,
      workerAgent,
      invoiceKey,
      jobId,
      transactions,
    },
    null,
    2,
  ),
);
