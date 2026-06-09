import {
  createWalletClient,
  custom,
  formatUnits,
  keccak256,
  parseUnits,
  stringToHex,
} from "viem";
import { celo } from "viem/chains";
import { ensureCelo, publicClient } from "@/lib/chain";
import {
  getStablecoinByAddress,
  invoiceRegistryAbi,
  stablecoins,
} from "@/lib/celo";
import {
  Invoice,
  InvoiceDraft,
  InvoiceMetadata,
  InvoiceStatus,
  StablecoinSymbol,
} from "@/lib/types";
import { getWalletProvider } from "@/lib/wallet";

const registry = process.env
  .NEXT_PUBLIC_INVOICE_REGISTRY_ADDRESS as `0x${string}` | undefined;
const deploymentBlock = BigInt(
  process.env.NEXT_PUBLIC_REGISTRY_DEPLOYMENT_BLOCK ?? "0",
);

function dueTimestamp(value: string) {
  const days = value.match(/in\s+(\d+)\s+days?/i);
  if (days) {
    return Math.floor(Date.now() / 1000) + Number(days[1]) * 86400;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed)
    ? Math.floor(Date.now() / 1000) + 7 * 86400
    : Math.floor(parsed / 1000);
}

function parseMetadata(value: string): InvoiceMetadata {
  try {
    return JSON.parse(value) as InvoiceMetadata;
  } catch {
    return {
      externalId: "Unknown invoice",
      client: "Unknown client",
      description: "Invoice",
      currency: "USDC",
    };
  }
}

function statusName(status: number, dueAt: number): InvoiceStatus {
  if (status === 1) return "paid";
  if (status === 2) return "cancelled";
  return dueAt < Math.floor(Date.now() / 1000) ? "overdue" : "pending";
}

export function registryConfigured() {
  return Boolean(registry && deploymentBlock > BigInt(0));
}

export async function registerInvoiceOnchain({
  invoice,
  recipient,
}: {
  invoice: InvoiceDraft;
  recipient: `0x${string}`;
}) {
  const provider = getWalletProvider();
  if (!registry || !provider) {
    throw new Error("Payflow registry or wallet is unavailable.");
  }
  await ensureCelo(provider);
  const walletClient = createWalletClient({
    chain: celo,
    transport: custom(provider),
  });
  const accounts = await walletClient.getAddresses();
  const account = accounts[0] ?? (await walletClient.requestAddresses())[0];
  const token = stablecoins[invoice.currency];
  const externalId = `PF-${Date.now().toString(36).toUpperCase()}`;
  const invoiceKey = keccak256(
    stringToHex(`${account}:${externalId}:${crypto.randomUUID()}`),
  );
  const metadata: InvoiceMetadata = {
    externalId,
    client: invoice.client,
    description: invoice.description,
    currency: invoice.currency,
  };
  const hash = await walletClient.writeContract({
    account,
    address: registry,
    abi: invoiceRegistryAbi,
    functionName: "createInvoice",
    args: [
      invoiceKey,
      recipient,
      token.address,
      parseUnits(String(invoice.amount), token.decimals),
      BigInt(dueTimestamp(invoice.dueDate)),
      JSON.stringify(metadata),
    ],
    feeCurrency: token.feeCurrency,
    type: "legacy",
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Invoice registration failed.");
  return { hash, invoiceKey };
}

export async function loadInvoice(invoiceKey: `0x${string}`): Promise<Invoice> {
  if (!registry) throw new Error("Payflow registry is unavailable.");
  const record = await publicClient.readContract({
    address: registry,
    abi: invoiceRegistryAbi,
    functionName: "invoices",
    args: [invoiceKey],
  });
  const [
    issuer,
    recipient,
    token,
    amountRaw,
    createdAt,
    dueAt,
    lastReminderAt,
    paymentTxReference,
    rawStatus,
    rawMetadata,
  ] = record;
  if (issuer === "0x0000000000000000000000000000000000000000") {
    throw new Error("Invoice not found.");
  }
  const metadata = parseMetadata(rawMetadata);
  const tokenEntry = getStablecoinByAddress(token);
  if (!tokenEntry) throw new Error("Unsupported invoice currency.");
  const [currency, tokenConfig] = tokenEntry as [
    StablecoinSymbol,
    (typeof stablecoins)[StablecoinSymbol],
  ];
  return {
    key: invoiceKey,
    id: metadata.externalId,
    issuer,
    recipient,
    token,
    amountRaw,
    amount: Number(formatUnits(amountRaw, tokenConfig.decimals)),
    currency,
    client: metadata.client,
    description: metadata.description,
    dueDate: new Date(Number(dueAt) * 1000).toLocaleDateString(),
    createdAt: Number(createdAt),
    dueAt: Number(dueAt),
    lastReminderAt: Number(lastReminderAt),
    paymentTxReference,
    status: statusName(Number(rawStatus), Number(dueAt)),
  };
}

export async function loadInvoicesForIssuer(
  issuer: `0x${string}`,
): Promise<Invoice[]> {
  if (!registry || deploymentBlock === BigInt(0)) return [];
  const events = await publicClient.getContractEvents({
    address: registry,
    abi: invoiceRegistryAbi,
    eventName: "InvoiceCreated",
    args: { issuer },
    fromBlock: deploymentBlock,
    strict: true,
  });
  const invoices = await Promise.all(
    events.map((event) => loadInvoice(event.args.invoiceId)),
  );
  return invoices.sort((a, b) => b.createdAt - a.createdAt);
}
