import {
  createWalletClient,
  custom,
  encodeAbiParameters,
  formatUnits,
  keccak256,
  parseEventLogs,
  parseUnits,
  stringToHex,
  zeroAddress,
} from "viem";
import { celo } from "viem/chains";
import { ensureCelo, publicClient } from "@/lib/chain";
import {
  erc20TransferAbi,
  getStablecoinByAddress,
  stablecoins,
} from "@/lib/celo";
import {
  JobMetadata,
  JobStatus,
  JobVerification,
  PayflowJob,
  StablecoinSymbol,
} from "@/lib/types";
import { getWalletProvider } from "@/lib/wallet";

const jobComponents = [
  { name: "requester", type: "address" },
  { name: "requesterAgent", type: "address" },
  { name: "worker", type: "address" },
  { name: "workerAgent", type: "address" },
  { name: "token", type: "address" },
  { name: "verifier", type: "address" },
  { name: "resolver", type: "address" },
  { name: "reward", type: "uint256" },
  { name: "acceptanceDeadline", type: "uint64" },
  { name: "workDeadline", type: "uint64" },
  { name: "reviewPeriod", type: "uint64" },
  { name: "submittedAt", type: "uint64" },
  { name: "verificationMode", type: "uint8" },
  { name: "status", type: "uint8" },
  { name: "specificationHash", type: "bytes32" },
  { name: "deliverableHash", type: "bytes32" },
  { name: "metadataURI", type: "string" },
  { name: "deliverableURI", type: "string" },
] as const;

const jobRequestComponents = [
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
] as const;

export const jobMarketplaceAbi = [
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
      { name: "request", type: "tuple", components: jobRequestComponents },
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
  {
    name: "acceptJob",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "worker", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "submitWork",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "worker", type: "address" },
      { name: "deliverableHash", type: "bytes32" },
      { name: "deliverableURI", type: "string" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "approveWork",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "rejectSubmission",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "reasonHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "raiseDispute",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "reasonHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "resolveDispute",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "payWorker", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "cancelPostedJob",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "cancelFundedJob",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "claimDeadlineRefund",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "claimReviewTimeout",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getJob",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [{ name: "job", type: "tuple", components: jobComponents }],
  },
  {
    name: "JobPosted",
    type: "event",
    anonymous: false,
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "requester", type: "address", indexed: true },
      { name: "requesterAgent", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "reward", type: "uint256", indexed: false },
      { name: "verificationMode", type: "uint8", indexed: false },
      { name: "specificationHash", type: "bytes32", indexed: false },
      { name: "metadataURI", type: "string", indexed: false },
    ],
  },
] as const;

const statusNames: JobStatus[] = [
  "posted",
  "funded",
  "accepted",
  "submitted",
  "disputed",
  "completed",
  "cancelled",
  "refunded",
];

const marketplace = process.env
  .NEXT_PUBLIC_JOB_MARKETPLACE_ADDRESS as `0x${string}` | undefined;
const deploymentBlock = BigInt(
  process.env.NEXT_PUBLIC_JOB_MARKETPLACE_DEPLOYMENT_BLOCK ?? "0",
);
const invoiceVerifier = process.env
  .NEXT_PUBLIC_INVOICE_JOB_VERIFIER_ADDRESS as `0x${string}` | undefined;

export function jobMarketplaceConfigured() {
  return Boolean(marketplace && deploymentBlock > BigInt(0));
}

export function parseJobMetadata(value: string): JobMetadata {
  try {
    const source = value.startsWith("data:application/json,")
      ? decodeURIComponent(value.slice("data:application/json,".length))
      : value;
    return JSON.parse(source) as JobMetadata;
  } catch {
    return {
      title: "Untitled job",
      description: value || "No description supplied.",
      category: "General",
      currency: "USDC",
    };
  }
}

function jobField(
  value: readonly unknown[] | Record<string, unknown>,
  index: number,
  name: string,
) {
  return Array.isArray(value)
    ? value[index]
    : (value as Record<string, unknown>)[name];
}

function normalizeJob(
  id: number,
  value: readonly unknown[] | Record<string, unknown>,
): PayflowJob {
  const tokenValue = jobField(value, 4, "token");
  if (typeof tokenValue !== "string") {
    throw new Error(`Job #${id} returned an invalid token address.`);
  }
  const token = tokenValue as `0x${string}`;
  const tokenEntry = getStablecoinByAddress(token);
  if (!tokenEntry) {
    throw new Error(`Job #${id} uses an unsupported reward token.`);
  }
  const currency = (tokenEntry?.[0] ?? "USDC") as StablecoinSymbol;
  const decimals = tokenEntry?.[1].decimals ?? 6;
  const metadataValue = jobField(value, 16, "metadataURI");
  const metadataURI =
    typeof metadataValue === "string" ? metadataValue : "";
  const metadata = parseJobMetadata(metadataURI);
  return {
    id,
    requester: jobField(value, 0, "requester") as `0x${string}`,
    requesterAgent: jobField(value, 1, "requesterAgent") as `0x${string}`,
    worker: jobField(value, 2, "worker") as `0x${string}`,
    workerAgent: jobField(value, 3, "workerAgent") as `0x${string}`,
    token,
    verifier: jobField(value, 5, "verifier") as `0x${string}`,
    resolver: jobField(value, 6, "resolver") as `0x${string}`,
    rewardRaw: jobField(value, 7, "reward") as bigint,
    reward: Number(
      formatUnits(jobField(value, 7, "reward") as bigint, decimals),
    ),
    acceptanceDeadline: Number(
      jobField(value, 8, "acceptanceDeadline"),
    ),
    workDeadline: Number(jobField(value, 9, "workDeadline")),
    reviewPeriod: Number(jobField(value, 10, "reviewPeriod")),
    submittedAt: Number(jobField(value, 11, "submittedAt")),
    verification:
      Number(jobField(value, 12, "verificationMode")) === 1
        ? "invoice"
        : "requester",
    status:
      statusNames[Number(jobField(value, 13, "status"))] ?? "posted",
    specificationHash: jobField(
      value,
      14,
      "specificationHash",
    ) as `0x${string}`,
    deliverableHash: jobField(
      value,
      15,
      "deliverableHash",
    ) as `0x${string}`,
    metadataURI,
    deliverableURI: jobField(value, 17, "deliverableURI") as string,
    metadata: { ...metadata, currency },
  };
}

export async function loadJobs(): Promise<PayflowJob[]> {
  if (!marketplace || deploymentBlock === BigInt(0)) return [];
  const count = await publicClient.readContract({
    address: marketplace,
    abi: jobMarketplaceAbi,
    functionName: "jobCount",
  });
  const records = await Promise.all(
    Array.from({ length: Number(count) }, async (_, index) => {
      const id = index + 1;
      const value = await publicClient.readContract({
        address: marketplace,
        abi: jobMarketplaceAbi,
        functionName: "getJob",
        args: [BigInt(id)],
      });
      return normalizeJob(
        id,
        value as unknown as readonly unknown[] | Record<string, unknown>,
      );
    }),
  );
  return records.sort((a, b) => b.id - a.id);
}

async function walletContext() {
  const provider = getWalletProvider();
  if (!provider || !marketplace) {
    throw new Error("Connect a wallet and configure the job marketplace.");
  }
  await ensureCelo(provider);
  const walletClient = createWalletClient({
    chain: celo,
    transport: custom(provider),
  });
  const account =
    (await walletClient.getAddresses())[0] ??
    (await walletClient.requestAddresses())[0];
  return { walletClient, account, marketplace };
}

async function wait(hash: `0x${string}`) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Job transaction failed.");
  return receipt;
}

export async function postJob(input: {
  title: string;
  description: string;
  category: string;
  amount: number;
  currency: StablecoinSymbol;
  acceptanceDays: number;
  workDays: number;
  reviewDays: number;
  verification: JobVerification;
  invoiceKey?: `0x${string}`;
  resolver?: `0x${string}`;
}) {
  const { walletClient, account, marketplace: address } = await walletContext();
  const token = stablecoins[input.currency];
  const metadata: JobMetadata = {
    title: input.title,
    description: input.description,
    category: input.category,
    currency: input.currency,
    ...(input.invoiceKey ? { invoiceKey: input.invoiceKey } : {}),
  };
  const metadataURI = `data:application/json,${encodeURIComponent(
    JSON.stringify(metadata),
  )}`;
  const now = Math.floor(Date.now() / 1000);
  const specificationHash =
    input.verification === "invoice" && input.invoiceKey
      ? keccak256(
          encodeAbiParameters([{ type: "bytes32" }], [input.invoiceKey]),
        )
      : keccak256(stringToHex(JSON.stringify(metadata)));
  if (input.verification === "invoice" && (!invoiceVerifier || !input.invoiceKey)) {
    throw new Error("Invoice verification is not configured.");
  }
  const hash = await walletClient.writeContract({
    account,
    address,
    abi: jobMarketplaceAbi,
    functionName: "postJob",
    args: [
      account,
      {
        token: token.address,
        reward: parseUnits(String(input.amount), token.decimals),
        acceptanceDeadline: BigInt(now + input.acceptanceDays * 86400),
        workDeadline: BigInt(
          now + (input.acceptanceDays + input.workDays) * 86400,
        ),
        reviewPeriod: BigInt(input.reviewDays * 86400),
        verificationMode: input.verification === "invoice" ? 1 : 0,
        verifier: input.verification === "invoice" ? invoiceVerifier! : zeroAddress,
        resolver: input.resolver ?? zeroAddress,
        specificationHash,
        metadataURI,
      },
    ],
    feeCurrency: token.feeCurrency,
    type: "legacy",
  });
  const receipt = await wait(hash);
  const logs = parseEventLogs({
    abi: jobMarketplaceAbi,
    eventName: "JobPosted",
    logs: receipt.logs,
  });
  return { hash, jobId: Number(logs[0]?.args.jobId ?? BigInt(0)) };
}

export async function fundJob(job: PayflowJob) {
  const { walletClient, account, marketplace: address } = await walletContext();
  const tokenEntry = getStablecoinByAddress(job.token);
  if (!tokenEntry) throw new Error("Unsupported reward token.");
  const [, token] = tokenEntry;
  const allowance = await publicClient.readContract({
    address: job.token,
    abi: erc20TransferAbi,
    functionName: "allowance",
    args: [account, address],
  });
  if (allowance < job.rewardRaw) {
    const approvalHash = await walletClient.writeContract({
      account,
      address: job.token,
      abi: erc20TransferAbi,
      functionName: "approve",
      args: [address, job.rewardRaw],
      feeCurrency: token.feeCurrency,
      type: "legacy",
    });
    await wait(approvalHash);
  }
  return writeJob("fundJob", [BigInt(job.id)], token.feeCurrency);
}

async function writeJob(
  functionName:
    | "fundJob"
    | "acceptJob"
    | "submitWork"
    | "approveWork"
    | "rejectSubmission"
    | "raiseDispute"
    | "resolveDispute"
    | "cancelPostedJob"
    | "cancelFundedJob"
    | "claimDeadlineRefund"
    | "claimReviewTimeout",
  args: readonly unknown[],
  feeCurrency?: `0x${string}`,
) {
  const { walletClient, account, marketplace: address } = await walletContext();
  const hash = await walletClient.writeContract({
    account,
    address,
    abi: jobMarketplaceAbi,
    functionName,
    args: args as never,
    ...(feeCurrency ? { feeCurrency } : {}),
    type: "legacy",
  });
  await wait(hash);
  return hash;
}

function jobFeeCurrency(job: PayflowJob) {
  return getStablecoinByAddress(job.token)?.[1].feeCurrency;
}

export function acceptJob(job: PayflowJob, worker: `0x${string}`) {
  return writeJob(
    "acceptJob",
    [BigInt(job.id), worker],
    jobFeeCurrency(job),
  );
}

export function approveJob(job: PayflowJob) {
  return writeJob("approveWork", [BigInt(job.id)], jobFeeCurrency(job));
}

export function rejectJob(job: PayflowJob, reason: string) {
  return writeJob(
    "rejectSubmission",
    [BigInt(job.id), keccak256(stringToHex(reason || "Changes requested"))],
    jobFeeCurrency(job),
  );
}

export function disputeJob(job: PayflowJob, reason: string) {
  return writeJob(
    "raiseDispute",
    [BigInt(job.id), keccak256(stringToHex(reason || "Disputed"))],
    jobFeeCurrency(job),
  );
}

export function resolveJob(job: PayflowJob, payWorker: boolean) {
  return writeJob(
    "resolveDispute",
    [BigInt(job.id), payWorker],
    jobFeeCurrency(job),
  );
}

export function cancelJob(job: PayflowJob) {
  return writeJob(
    job.status === "posted" ? "cancelPostedJob" : "cancelFundedJob",
    [BigInt(job.id)],
    jobFeeCurrency(job),
  );
}

export function claimJobRefund(job: PayflowJob) {
  return writeJob(
    "claimDeadlineRefund",
    [BigInt(job.id)],
    jobFeeCurrency(job),
  );
}

export function claimReviewPayment(job: PayflowJob) {
  return writeJob(
    "claimReviewTimeout",
    [BigInt(job.id)],
    jobFeeCurrency(job),
  );
}

export function submitJob(
  job: PayflowJob,
  worker: `0x${string}`,
  deliverableURI: string,
) {
  let deliverableHash: `0x${string}`;
  let proof: `0x${string}` = "0x";
  if (job.verification === "invoice" && job.metadata.invoiceKey) {
    deliverableHash = keccak256(
      encodeAbiParameters(
        [{ type: "bytes32" }, { type: "uint8" }],
        [job.metadata.invoiceKey, 1],
      ),
    );
    proof = encodeAbiParameters(
      [{ type: "bytes32" }],
      [job.metadata.invoiceKey],
    );
  } else {
    deliverableHash = keccak256(stringToHex(deliverableURI));
  }
  return writeJob(
    "submitWork",
    [BigInt(job.id), worker, deliverableHash, deliverableURI, proof],
    jobFeeCurrency(job),
  );
}
