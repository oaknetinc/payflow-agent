import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  keccak256,
  parseUnits,
  stringToHex,
} from "viem";
import { celo } from "viem/chains";
import { invoiceRegistryAbi, stablecoins } from "@/lib/celo";
import { Invoice } from "@/lib/types";

export async function registerInvoiceOnchain({
  invoice,
  recipient,
}: {
  invoice: Invoice;
  recipient: `0x${string}`;
}) {
  const registry = process.env
    .NEXT_PUBLIC_INVOICE_REGISTRY_ADDRESS as `0x${string}` | undefined;
  if (!registry || !window.ethereum) return null;

  const walletClient = createWalletClient({
    chain: celo,
    transport: custom(window.ethereum),
  });
  const accounts = await walletClient.getAddresses();
  const account = accounts[0] ?? (await walletClient.requestAddresses())[0];
  const token = stablecoins[invoice.currency];
  const dueAt = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);
  const metadataHash = keccak256(
    stringToHex(
      JSON.stringify({
        client: invoice.client,
        description: invoice.description,
        dueDate: invoice.dueDate,
      }),
    ),
  );

  const hash = await walletClient.writeContract({
    account,
    address: registry,
    abi: invoiceRegistryAbi,
    functionName: "createInvoice",
    args: [
      keccak256(stringToHex(invoice.id)),
      recipient,
      token.address,
      parseUnits(String(invoice.amount), token.decimals),
      dueAt,
      metadataHash,
    ],
    feeCurrency: token.feeCurrency,
  });

  const publicClient = createPublicClient({ chain: celo, transport: http() });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Invoice registration failed");
  return hash;
}
