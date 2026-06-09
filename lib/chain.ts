import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { CELO_CHAIN_HEX } from "@/lib/celo";

export const publicClient = createPublicClient({
  chain: celo,
  transport: http(process.env.NEXT_PUBLIC_CELO_RPC_URL),
});

export async function ensureCelo() {
  if (!window.ethereum) throw new Error("Open Payflow in MiniPay or a wallet browser.");
  const chainId = (await window.ethereum.request({
    method: "eth_chainId",
  })) as string;
  if (chainId.toLowerCase() === CELO_CHAIN_HEX) return;
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: CELO_CHAIN_HEX }],
  });
}
