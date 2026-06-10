import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { CELO_CHAIN_HEX } from "@/lib/celo";
import { getWalletProvider } from "@/lib/wallet";

export const publicClient = createPublicClient({
  chain: celo,
  transport: http(process.env.NEXT_PUBLIC_CELO_RPC_URL),
});

export async function ensureCelo(provider = getWalletProvider()) {
  if (!provider) throw new Error("Connect a wallet to continue.");
  const chainId = (await provider.request({
    method: "eth_chainId",
  })) as unknown;
  if (typeof chainId !== "string") {
    throw new Error("The connected wallet returned an invalid network.");
  }
  if (chainId.toLowerCase() === CELO_CHAIN_HEX) return;
  await provider.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: CELO_CHAIN_HEX }],
  });
}
