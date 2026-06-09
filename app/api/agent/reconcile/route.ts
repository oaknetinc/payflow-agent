import { NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import {
  agentFactoryAbi,
  invoiceRegistryAbi,
  payflowAgentAbi,
} from "@/lib/celo";

export const maxDuration = 60;

const publicClient = createPublicClient({ chain: celo, transport: http() });
const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function reconcile() {
  const registry = process.env
    .NEXT_PUBLIC_INVOICE_REGISTRY_ADDRESS as `0x${string}` | undefined;
  const privateKey = process.env.AGENT_PRIVATE_KEY as
    | `0x${string}`
    | undefined;
  const deploymentBlock = BigInt(process.env.REGISTRY_DEPLOYMENT_BLOCK ?? "0");
  const factory = process.env
    .NEXT_PUBLIC_AGENT_FACTORY_ADDRESS as `0x${string}` | undefined;
  if (!registry || !factory || !privateKey || deploymentBlock === BigInt(0)) {
    throw new Error("Agent reconciliation is not configured");
  }

  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport: http(),
  });
  const created = await publicClient.getContractEvents({
    address: registry,
    abi: invoiceRegistryAbi,
    eventName: "InvoiceCreated",
    fromBlock: deploymentBlock,
    strict: true,
  });
  const paid = await publicClient.getContractEvents({
    address: registry,
    abi: invoiceRegistryAbi,
    eventName: "InvoicePaid",
    fromBlock: deploymentBlock,
    strict: true,
  });
  const usedPaymentHashes = new Set(
    paid
      .map((event) => event.args.paymentTxReference)
      .filter((hash): hash is `0x${string}` => Boolean(hash)),
  );

  const reconciled: string[] = [];
  const reminded: string[] = [];
  for (const event of created) {
    const invoiceId = event.args.invoiceId;
    if (!invoiceId || !event.blockNumber) continue;
    const invoice = await publicClient.readContract({
      address: registry,
      abi: invoiceRegistryAbi,
      functionName: "invoices",
      args: [invoiceId],
    });
    const [
      issuer,
      recipient,
      token,
      amount,
      createdAt,
      ,
      lastReminderAt,
      ,
      status,
    ] = invoice;
    if (status !== 0) continue;

    const payments = await publicClient.getLogs({
      address: token,
      event: transferEvent,
      args: { to: recipient },
      fromBlock: event.blockNumber,
      toBlock: "latest",
      strict: true,
    });
    const payment = payments.find(
      (log) =>
        log.args.value === amount &&
        Boolean(log.transactionHash) &&
        !usedPaymentHashes.has(log.transactionHash),
    );
    if (payment?.transactionHash) {
      const hash = await walletClient.writeContract({
        address: registry,
        abi: invoiceRegistryAbi,
        functionName: "markPaid",
        args: [invoiceId, payment.transactionHash],
        gasPrice: await publicClient.getGasPrice(),
        type: "legacy",
      });
      await publicClient.waitForTransactionReceipt({ hash });
      usedPaymentHashes.add(payment.transactionHash);
      reconciled.push(invoiceId);
      continue;
    }

    const agent = await publicClient.readContract({
      address: factory,
      abi: agentFactoryAbi,
      functionName: "agentOf",
      args: [issuer],
    });
    if (agent === "0x0000000000000000000000000000000000000000") continue;
    const [delay, enabled] = await Promise.all([
      publicClient.readContract({
        address: agent,
        abi: payflowAgentAbi,
        functionName: "reminderDelay",
      }),
      publicClient.readContract({
        address: agent,
        abi: payflowAgentAbi,
        functionName: "automationEnabled",
      }),
    ]);
    const now = BigInt(Math.floor(Date.now() / 1000));
    const reminderBase =
      lastReminderAt === BigInt(0) ? createdAt : lastReminderAt;
    if (!enabled || now < reminderBase + BigInt(delay)) continue;
    const hash = await walletClient.writeContract({
      address: registry,
      abi: invoiceRegistryAbi,
      functionName: "recordReminder",
      args: [invoiceId],
      gasPrice: await publicClient.getGasPrice(),
      type: "legacy",
    });
    await publicClient.waitForTransactionReceipt({ hash });
    reminded.push(invoiceId);
  }

  return {
    checked: created.length,
    reconciled: reconciled.length,
    reminded: reminded.length,
    invoiceIds: reconciled,
    remindedInvoiceIds: reminded,
  };
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await reconcile());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reconcile failed" },
      { status: 500 },
    );
  }
}

export const POST = GET;
