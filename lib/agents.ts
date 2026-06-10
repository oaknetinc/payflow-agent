import { createWalletClient, custom } from "viem";
import { celo } from "viem/chains";
import { ensureCelo, publicClient } from "@/lib/chain";
import { agentFactoryAbi, payflowAgentAbi } from "@/lib/celo";
import { UserAgent } from "@/lib/types";
import { getWalletProvider } from "@/lib/wallet";

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
  const provider = getWalletProvider();
  if (!factory || !provider) {
    throw new Error("Agent factory or wallet is unavailable.");
  }
  const existing = await loadUserAgent(owner);
  if (existing) {
    throw new Error(
      `This wallet already owns agent ${existing.address.slice(0, 8)}…`,
    );
  }
  await ensureCelo(provider);
  const walletClient = createWalletClient({
    chain: celo,
    transport: custom(provider),
  });
  const hash = await walletClient.writeContract({
    account: owner,
    address: factory,
    abi: agentFactoryAbi,
    functionName: "createAgent",
    args: [name, reminderDays * 86400],
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
  const provider = getWalletProvider();
  if (!provider) throw new Error("Wallet is unavailable.");
  await ensureCelo(provider);
  const walletClient = createWalletClient({
    chain: celo,
    transport: custom(provider),
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
    type: "legacy",
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Agent update failed.");
  return hash;
}
