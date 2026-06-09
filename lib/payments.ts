import {
  createWalletClient,
  createPublicClient,
  custom,
  encodeFunctionData,
  parseUnits,
  http,
} from "viem";
import { celo } from "viem/chains";
import { erc20TransferAbi, stablecoins } from "@/lib/celo";
import { StablecoinSymbol } from "@/lib/types";

export async function payStablecoin({
  amount,
  currency,
  recipient,
}: {
  amount: string;
  currency: StablecoinSymbol;
  recipient: `0x${string}`;
}) {
  if (!window.ethereum) {
    throw new Error("Open this payment request inside MiniPay.");
  }

  const walletClient = createWalletClient({
    chain: celo,
    transport: custom(window.ethereum),
  });
  const accounts = await walletClient.getAddresses();
  const account = accounts[0] ?? (await walletClient.requestAddresses())[0];
  const token = stablecoins[currency];
  const value = parseUnits(amount, token.decimals);
  const data = encodeFunctionData({
    abi: erc20TransferAbi,
    functionName: "transfer",
    args: [recipient, value],
  });

  const hash = await walletClient.sendTransaction({
    account,
    to: token.address,
    data,
    feeCurrency: token.feeCurrency,
  });

  const publicClient = createPublicClient({ chain: celo, transport: http() });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Payment was not completed. Your funds were not sent.");
  }
  return { hash, receipt };
}
