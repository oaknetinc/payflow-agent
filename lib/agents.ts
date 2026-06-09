import { createWalletClient, custom } from "viem";
import { celo } from "viem/chains";
import { ensureCelo, publicClient } from "@/lib/chain";
import { agentFactoryAbi, payflowAgentAbi, stablecoins } from "@/lib/celo";
import { UserAgent } from "@/lib/types";

const factory = process.env
  .NEXT_PUBLIC_AGENT_FACTORY_ADDRESS as `0x${string}` | undefined;
const zeroAddress = "0x0000000000000000000000000000000000000000";

export async function loadUserAgent(
  owner: `0x${string}`,
): Promise<UserAgent | null> {
  if (!factory) return null;
  const address = await publicClient.readContract({
    address: factory,
    abi: agentFactoryAbi,
    functionName: "agentOf",
    args: [owner],
  });
  if (address === zeroAddress) return null;
  const [name, operator, reminderDelay, automationEnabled] = await Promise.all([
    publicClient.readContract({
      address,
      abi: payflowAgentAbi,
      functionName: "name",
    }),
    publicClient.readContract({
      address,
      abi: payflowAgentAbi,
      functionName: "operator",
    }),
    publicClient.readContract({
      address,
      abi: payflowAgentAbi,
      functionName: "reminderDelay",
    }),
    publicClient.readContract({
      address,
      abi: payflowAgentAbi,
      functionName: "automationEnabled",
    }),
  ]);
  return {
    address,
    name,
    operator,
    reminderDelay: Number(reminderDelay),
    automationEnabled,
  };
}

export async function createUserAgent(
  owner: `0x${string}`,
  name: string,
  reminderDays: number,
) {
  if (!factory || !window.ethereum) {
    throw new Error("Agent factory or wallet is unavailable.");
  }
  await ensureCelo();
  const walletClient = createWalletClient({
    chain: celo,
    transport: custom(window.ethereum),
  });
  const hash = await walletClient.writeContract({
    account: owner,
    address: factory,
    abi: agentFactoryAbi,
    functionName: "createAgent",
    args: [name, reminderDays * 86400],
    feeCurrency: stablecoins.USDC.feeCurrency,
    type: "legacy",
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Agent creation failed.");
  return hash;
}

export async function updateUserAgent(
  owner: `0x${string}`,
  agent: UserAgent,
  name: string,
  reminderDays: number,
  automationEnabled: boolean,
) {
  if (!window.ethereum) throw new Error("Wallet is unavailable.");
  await ensureCelo();
  const walletClient = createWalletClient({
    chain: celo,
    transport: custom(window.ethereum),
  });
  const hash = await walletClient.writeContract({
    account: owner,
    address: agent.address,
    abi: payflowAgentAbi,
    functionName: "update",
    args: [
      name,
      agent.operator,
      reminderDays * 86400,
      automationEnabled,
    ],
    feeCurrency: stablecoins.USDC.feeCurrency,
    type: "legacy",
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Agent update failed.");
  return hash;
}
