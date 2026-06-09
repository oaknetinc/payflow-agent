"use client";

import { useCallback, useEffect, useState } from "react";
import { ensureCelo } from "@/lib/chain";
import {
  createWalletConnectProvider,
  setWalletProvider,
} from "@/lib/wallet";

type WalletKind = "minipay" | "injected" | "walletconnect" | null;

export function useMiniPay() {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [isMiniPay, setIsMiniPay] = useState(false);
  const [walletKind, setWalletKind] = useState<WalletKind>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const bindProvider = useCallback(
    async (provider: EthereumProvider, kind: Exclude<WalletKind, null>) => {
      setWalletProvider(provider);
      await ensureCelo(provider);
      const accounts = (await provider.request({
        method: "eth_accounts",
      })) as `0x${string}`[];
      setAddress(accounts[0] ?? null);
      setWalletKind(kind);
      setIsMiniPay(kind === "minipay");
    },
    [],
  );

  const connectInjected = useCallback(async () => {
    const provider = window.ethereum;
    if (!provider) {
      setError("No browser wallet was detected.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await provider.request({ method: "eth_requestAccounts" });
      await bindProvider(
        provider,
        provider.isMiniPay ? "minipay" : "injected",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet connection failed.");
    } finally {
      setIsLoading(false);
    }
  }, [bindProvider]);

  const connectWalletConnect = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const provider = await createWalletConnectProvider();
      if (provider.connect) {
        await provider.connect();
      } else {
        await provider.request({ method: "eth_requestAccounts" });
      }
      await bindProvider(provider, "walletconnect");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "WalletConnect failed.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [bindProvider]);

  const connect = useCallback(async () => {
    if (window.ethereum) {
      await connectInjected();
      return;
    }
    await connectWalletConnect();
  }, [connectInjected, connectWalletConnect]);

  const disconnect = useCallback(async () => {
    setWalletProvider(null);
    setAddress(null);
    setWalletKind(null);
    setIsMiniPay(false);
  }, []);

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) {
      const timer = window.setTimeout(() => setIsLoading(false), 0);
      return () => window.clearTimeout(timer);
    }
    const kind = provider.isMiniPay ? "minipay" : "injected";
    const updateAccounts = (...args: unknown[]) => {
      const accounts = (args[0] ?? []) as `0x${string}`[];
      setAddress(accounts[0] ?? null);
      if (!accounts[0]) setWalletKind(null);
    };
    const initialize = window.setTimeout(() => {
      setWalletProvider(provider);
      setIsMiniPay(kind === "minipay");
      void provider
        .request({ method: "eth_accounts" })
        .then((accounts) => {
          updateAccounts(accounts);
          if ((accounts as string[])[0]) setWalletKind(kind);
        })
        .finally(() => setIsLoading(false));
    }, 0);
    provider.on?.("accountsChanged", updateAccounts);
    return () => {
      window.clearTimeout(initialize);
      provider.removeListener?.("accountsChanged", updateAccounts);
    };
  }, []);

  return {
    address,
    connect,
    connectInjected,
    connectWalletConnect,
    disconnect,
    hasInjectedWallet: Boolean(
      typeof window !== "undefined" && window.ethereum,
    ),
    walletConnectConfigured: Boolean(
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    ),
    walletKind,
    isMiniPay,
    isLoading,
    error,
  };
}
