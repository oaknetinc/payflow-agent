"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPublicClient, formatUnits, http } from "viem";
import { celo } from "viem/chains";
import { erc20TransferAbi, stablecoins } from "@/lib/celo";
import { StablecoinSymbol } from "@/lib/types";

type Balances = Record<StablecoinSymbol, number>;

const emptyBalances: Balances = { USDC: 0, USDT: 0, USDm: 0 };
const publicClient = createPublicClient({ chain: celo, transport: http() });

export function useStablecoinBalances(address: `0x${string}` | null) {
  const [balances, setBalances] = useState<Balances>(emptyBalances);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!address) {
      setBalances(emptyBalances);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const entries = await Promise.all(
        (Object.keys(stablecoins) as StablecoinSymbol[]).map(
          async (symbol) => {
            const token = stablecoins[symbol];
            const raw = await publicClient.readContract({
              address: token.address,
              abi: erc20TransferAbi,
              functionName: "balanceOf",
              args: [address],
            });
            return [symbol, Number(formatUnits(raw, token.decimals))] as const;
          },
        ),
      );
      setBalances(Object.fromEntries(entries) as Balances);
    } catch (cause) {
      setBalances(emptyBalances);
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load stablecoin balances.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const preferred = useMemo(
    () =>
      (Object.entries(balances) as [StablecoinSymbol, number][]).sort(
        (a, b) => b[1] - a[1],
      )[0]?.[0] ?? "USDC",
    [balances],
  );

  return { balances, preferred, isLoading, error, refresh };
}
