let activeProvider: EthereumProvider | null = null;

export function setWalletProvider(provider: EthereumProvider | null) {
  activeProvider = provider;
}

export function getWalletProvider() {
  return activeProvider ?? window.ethereum ?? null;
}

export async function createWalletConnectProvider() {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      "WalletConnect is not configured yet. Add a Reown project ID.",
    );
  }
  const { EthereumProvider } = await import(
    "@walletconnect/ethereum-provider"
  );
  return (await EthereumProvider.init({
    projectId,
    chains: [42220],
    optionalChains: [42220],
    showQrModal: true,
    metadata: {
      name: "Payflow Agent",
      description: "Create and pay verified stablecoin invoices on Celo.",
      url: window.location.origin,
      icons: [`${window.location.origin}/logo.svg`],
    },
    rpcMap: {
      42220:
        process.env.NEXT_PUBLIC_CELO_RPC_URL ?? "https://forno.celo.org",
    },
  })) as unknown as EthereumProvider;
}
