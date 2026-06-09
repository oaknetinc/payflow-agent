import {
  createWalletClient,
  custom,
  parseUnits,
} from "viem";
import { celo } from "viem/chains";
import {
  erc20TransferAbi,
  paymentRouterAbi,
  stablecoins,
} from "@/lib/celo";
import { StablecoinSymbol } from "@/lib/types";
import { ensureCelo, publicClient } from "@/lib/chain";
import { getWalletProvider } from "@/lib/wallet";

export async function payStablecoinInvoice({
  invoiceKey,
  amount,
  currency,
}: {
  invoiceKey: `0x${string}`;
  amount: string;
  currency: StablecoinSymbol;
}) {
  const router = process.env
    .NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS as `0x${string}` | undefined;
  const provider = getWalletProvider();
  if (!provider || !router) {
    throw new Error("Open this request inside MiniPay or a wallet browser.");
  }
  await ensureCelo(provider);
  const walletClient = createWalletClient({
    chain: celo,
    transport: custom(provider),
  });
  const accounts = await walletClient.getAddresses();
  const account = accounts[0] ?? (await walletClient.requestAddresses())[0];
  const token = stablecoins[currency];
  const value = parseUnits(amount, token.decimals);
  const allowance = await publicClient.readContract({
    address: token.address,
    abi: erc20TransferAbi,
    functionName: "allowance",
    args: [account, router],
  });

  if (allowance < value) {
    const approvalHash = await walletClient.writeContract({
      account,
      address: token.address,
      abi: erc20TransferAbi,
      functionName: "approve",
      args: [router, value],
      feeCurrency: token.feeCurrency,
      type: "legacy",
    });
    const approval = await publicClient.waitForTransactionReceipt({
      hash: approvalHash,
    });
    if (approval.status !== "success") {
      throw new Error("Token approval was not completed.");
    }
  }

  const hash = await walletClient.writeContract({
    account,
    address: router,
    abi: paymentRouterAbi,
    functionName: "payInvoice",
    args: [invoiceKey],
    feeCurrency: token.feeCurrency,
    type: "legacy",
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Invoice payment was not completed.");
  }
  return { hash, receipt };
}
