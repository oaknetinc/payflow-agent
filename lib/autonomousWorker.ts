import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  formatUnits,
  http,
  keccak256,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import {
  agentFactoryAbi,
  erc20TransferAbi,
  invoiceRegistryAbi,
  paymentRouterAbi,
} from "@/lib/celo";
import { jobMarketplaceAbi, loadJobs } from "@/lib/jobs";
import { PayflowJob } from "@/lib/types";

type WorkerDecision = {
  jobId: number;
  eligible: boolean;
  reason: string;
  invoiceAmount?: string;
  reward?: string;
};

const rpcUrl =
  process.env.CELO_RPC_URL ??
  process.env.NEXT_PUBLIC_CELO_RPC_URL ??
  "https://forno.celo.org";
const publicClient = createPublicClient({
  chain: celo,
  transport: http(rpcUrl),
});

function config() {
  const privateKey = (
    process.env.AUTONOMOUS_WORKER_PRIVATE_KEY ??
    process.env.AGENT_PRIVATE_KEY
  )?.trim() as `0x${string}` | undefined;
  const marketplace = process.env
    .NEXT_PUBLIC_JOB_MARKETPLACE_ADDRESS as `0x${string}` | undefined;
  const registry = process.env
    .NEXT_PUBLIC_INVOICE_REGISTRY_ADDRESS as `0x${string}` | undefined;
  const router = process.env
    .NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS as `0x${string}` | undefined;
  const factory = process.env
    .NEXT_PUBLIC_AGENT_FACTORY_ADDRESS as `0x${string}` | undefined;
  if (!privateKey || !marketplace || !registry || !router || !factory) {
    throw new Error("Autonomous worker is not configured.");
  }
  const account = privateKeyToAccount(privateKey);
  const workerOwner = (process.env.AUTONOMOUS_WORKER_OWNER?.trim() ??
    account.address) as `0x${string}`;
  return {
    account,
    marketplace,
    registry,
    router,
    factory,
    workerOwner,
    maxSpend: process.env.AUTONOMOUS_WORKER_MAX_SPEND?.trim() ?? "0.02",
    minProfit:
      process.env.AUTONOMOUS_WORKER_MIN_PROFIT?.trim() ?? "0.005",
  };
}

async function wait(hash: `0x${string}`) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Autonomous transaction ${hash} failed.`);
  }
  return receipt;
}

async function assess(
  job: PayflowJob,
  settings: ReturnType<typeof config>,
): Promise<WorkerDecision> {
  const assignedToWorker =
    job.status === "accepted" &&
    job.worker.toLowerCase() === settings.workerOwner.toLowerCase();
  if (job.status !== "funded" && !assignedToWorker) {
    return {
      jobId: job.id,
      eligible: false,
      reason: "Job is neither funded nor assigned to this worker.",
    };
  }
  if (job.verification !== "invoice" || !job.metadata.invoiceKey) {
    return {
      jobId: job.id,
      eligible: false,
      reason: "Only automatically verified invoice jobs are supported.",
    };
  }
  if (job.requester.toLowerCase() === settings.workerOwner.toLowerCase()) {
    return {
      jobId: job.id,
      eligible: false,
      reason: "The worker cannot accept its own job.",
    };
  }
  const now = Math.floor(Date.now() / 1000);
  if (now >= job.acceptanceDeadline || now >= job.workDeadline) {
    return { jobId: job.id, eligible: false, reason: "Job deadline passed." };
  }
  const [, invoiceToken, invoiceAmount, invoiceStatus] =
    await publicClient.readContract({
      address: settings.registry,
      abi: invoiceRegistryAbi,
      functionName: "paymentDetails",
      args: [job.metadata.invoiceKey],
    });
  if (invoiceStatus === 1 && assignedToWorker) {
    return {
      jobId: job.id,
      eligible: true,
      reason: "Resume submission for the paid invoice.",
      invoiceAmount: formatUnits(
        invoiceAmount,
        job.metadata.currency === "USDm" ? 18 : 6,
      ),
      reward: formatUnits(
        job.rewardRaw,
        job.metadata.currency === "USDm" ? 18 : 6,
      ),
    };
  }
  if (invoiceStatus !== 0) {
    return {
      jobId: job.id,
      eligible: false,
      reason: "Invoice is not pending.",
    };
  }
  if (invoiceToken.toLowerCase() !== job.token.toLowerCase()) {
    return {
      jobId: job.id,
      eligible: false,
      reason: "Invoice and reward tokens do not match.",
    };
  }
  const decimals = job.metadata.currency === "USDm" ? 18 : 6;
  const maxSpend = parseUnits(settings.maxSpend, decimals);
  const minProfit = parseUnits(settings.minProfit, decimals);
  if (invoiceAmount > maxSpend) {
    return {
      jobId: job.id,
      eligible: false,
      reason: "Invoice exceeds the autonomous spending cap.",
      invoiceAmount: formatUnits(invoiceAmount, decimals),
      reward: formatUnits(job.rewardRaw, decimals),
    };
  }
  if (job.rewardRaw < invoiceAmount + minProfit) {
    return {
      jobId: job.id,
      eligible: false,
      reason: "Reward does not meet the minimum profit rule.",
      invoiceAmount: formatUnits(invoiceAmount, decimals),
      reward: formatUnits(job.rewardRaw, decimals),
    };
  }
  const balance = await publicClient.readContract({
    address: invoiceToken,
    abi: erc20TransferAbi,
    functionName: "balanceOf",
    args: [settings.account.address],
  });
  if (balance < invoiceAmount) {
    return {
      jobId: job.id,
      eligible: false,
      reason: "Autonomous worker has insufficient stablecoin balance.",
      invoiceAmount: formatUnits(invoiceAmount, decimals),
      reward: formatUnits(job.rewardRaw, decimals),
    };
  }
  return {
    jobId: job.id,
    eligible: true,
    reason: "Eligible for autonomous invoice execution.",
    invoiceAmount: formatUnits(invoiceAmount, decimals),
    reward: formatUnits(job.rewardRaw, decimals),
  };
}

export async function autonomousWorkerStatus() {
  const settings = config();
  const [agent, delegated, jobs] = await Promise.all([
    publicClient.readContract({
      address: settings.factory,
      abi: agentFactoryAbi,
      functionName: "agentOf",
      args: [settings.workerOwner],
    }),
    publicClient.readContract({
      address: settings.factory,
      abi: agentFactoryAbi,
      functionName: "isOperatorFor",
      args: [settings.workerOwner, settings.account.address],
    }),
    loadJobs(),
  ]);
  const authorized =
    settings.workerOwner.toLowerCase() ===
      settings.account.address.toLowerCase() || delegated;
  const decisions = await Promise.all(
    jobs
      .filter((job) => ["funded", "accepted"].includes(job.status))
      .map((job) => assess(job, settings)),
  );
  return {
    configured: true,
    operator: settings.account.address,
    workerOwner: settings.workerOwner,
    agent,
    authorized,
    policy: {
      jobType: "paid Payflow invoice",
      maxSpend: settings.maxSpend,
      minProfit: settings.minProfit,
      oneJobPerRun: true,
    },
    decisions,
  };
}

export async function runAutonomousWorker() {
  const settings = config();
  const status = await autonomousWorkerStatus();
  if (!status.authorized) {
    throw new Error("Autonomous operator is not authorized for its agent.");
  }
  const decision = status.decisions.find((item) => item.eligible);
  if (!decision) {
    return { ...status, executed: false, reason: "No eligible job found." };
  }
  const jobs = await loadJobs();
  const job = jobs.find((item) => item.id === decision.jobId);
  if (!job?.metadata.invoiceKey) {
    throw new Error("Eligible job disappeared before execution.");
  }
  const walletClient = createWalletClient({
    account: settings.account,
    chain: celo,
    transport: http(rpcUrl),
  });
  let acceptHash: `0x${string}` | undefined;
  if (job.status === "funded") {
    acceptHash = await walletClient.writeContract({
      address: settings.marketplace,
      abi: jobMarketplaceAbi,
      functionName: "acceptJob",
      args: [BigInt(job.id), settings.workerOwner],
      type: "legacy",
    });
    await wait(acceptHash);
  }

  const [, invoiceToken, invoiceAmount, invoiceStatus] =
    await publicClient.readContract({
      address: settings.registry,
      abi: invoiceRegistryAbi,
      functionName: "paymentDetails",
      args: [job.metadata.invoiceKey],
    });
  let approvalHash: `0x${string}` | undefined;
  let paymentHash: `0x${string}` | undefined;
  if (invoiceStatus === 0) {
    const allowance = await publicClient.readContract({
      address: invoiceToken,
      abi: erc20TransferAbi,
      functionName: "allowance",
      args: [settings.account.address, settings.router],
    });
    if (allowance < invoiceAmount) {
      approvalHash = await walletClient.writeContract({
        address: invoiceToken,
        abi: erc20TransferAbi,
        functionName: "approve",
        args: [settings.router, invoiceAmount],
        type: "legacy",
      });
      await wait(approvalHash);
    }
    paymentHash = await walletClient.writeContract({
      address: settings.router,
      abi: paymentRouterAbi,
      functionName: "payInvoice",
      args: [job.metadata.invoiceKey],
      type: "legacy",
    });
    await wait(paymentHash);
  }

  const deliverableHash = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint8" }],
      [job.metadata.invoiceKey, 1],
    ),
  );
  const proof = encodeAbiParameters(
    [{ type: "bytes32" }],
    [job.metadata.invoiceKey],
  );
  const deliverableURI = paymentHash
    ? `https://celo.blockscout.com/tx/${paymentHash}`
    : `celo:invoice:${job.metadata.invoiceKey}`;
  const submitHash = await walletClient.writeContract({
    address: settings.marketplace,
    abi: jobMarketplaceAbi,
    functionName: "submitWork",
    args: [
      BigInt(job.id),
      settings.workerOwner,
      deliverableHash,
      deliverableURI,
      proof,
    ],
    type: "legacy",
  });
  await wait(submitHash);

  return {
    ...status,
    executed: true,
    jobId: job.id,
    transactions: {
      ...(acceptHash ? { accept: acceptHash } : {}),
      ...(approvalHash ? { approve: approvalHash } : {}),
      ...(paymentHash ? { payment: paymentHash } : {}),
      submit: submitHash,
    },
  };
}
