"use client";

import { useCallback, useEffect, useState } from "react";
import { ensureCelo } from "@/lib/chain";

export function useMiniPay() {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [isMiniPay, setIsMiniPay] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("Open Payflow inside MiniPay or an injected wallet browser.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      await ensureCelo();
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as `0x${string}`[];
      setAddress(accounts[0] ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet connection failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) {
      const timer = window.setTimeout(() => setIsLoading(false), 0);
      return () => window.clearTimeout(timer);
    }
    const activeProvider = provider;

    const initialize = window.setTimeout(() => {
      setIsMiniPay(activeProvider.isMiniPay === true);
      void activeProvider
        .request({ method: "eth_accounts" })
        .then((accounts) => updateAccounts(accounts))
        .finally(() => setIsLoading(false));
    }, 0);

    function updateAccounts(...args: unknown[]) {
      const accounts = (args[0] ?? []) as `0x${string}`[];
      setAddress(accounts[0] ?? null);
    }
    function updateChain() {
      void activeProvider
        .request({ method: "eth_accounts" })
        .then((accounts) => updateAccounts(accounts))
        .finally(() => setIsLoading(false));
    }

    activeProvider.on?.("accountsChanged", updateAccounts);
    activeProvider.on?.("chainChanged", updateChain);

    return () => {
      window.clearTimeout(initialize);
      activeProvider.removeListener?.("accountsChanged", updateAccounts);
      activeProvider.removeListener?.("chainChanged", updateChain);
    };
  }, []);

  return { address, connect, isMiniPay, isLoading, error };
}
