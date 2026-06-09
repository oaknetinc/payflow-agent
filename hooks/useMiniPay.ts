"use client";

import { useCallback, useEffect, useState } from "react";

export function useMiniPay() {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [isMiniPay, setIsMiniPay] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as `0x${string}`[];
      setAddress(accounts[0] ?? null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initializeProvider() {
      const provider = window.ethereum;
      await Promise.resolve();
      setIsMiniPay(provider?.isMiniPay === true);

      if (!provider) {
        setIsLoading(false);
        return;
      }

      if (provider.isMiniPay) {
        const accounts = (await provider.request({
          method: "eth_accounts",
        })) as `0x${string}`[];
        setAddress(accounts[0] ?? null);
        setIsLoading(false);
        return;
      }

      const accounts = (await provider.request({
        method: "eth_accounts",
      })) as `0x${string}`[];
      setAddress(accounts[0] ?? null);
      setIsLoading(false);
    }

    void initializeProvider();
  }, [connect]);

  return { address, connect, isMiniPay, isLoading };
}
