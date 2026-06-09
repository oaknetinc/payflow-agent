"use client";

import { useEffect, useState } from "react";

type Stats = {
  invoicesCreated: number;
  paymentsConfirmed: number;
  confirmedVolume: number;
  activeIssuers: number;
};

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/stats")
      .then(async (response) => {
        if (!response.ok) throw new Error("Stats are temporarily unavailable.");
        setStats((await response.json()) as Stats);
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Could not load stats."),
      );
  }, []);

  const metrics = stats
    ? [
        ["Invoices created", String(stats.invoicesCreated)],
        ["Payments confirmed", String(stats.paymentsConfirmed)],
        [
          "Confirmed volume",
          `USD ${stats.confirmedVolume.toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })}`,
        ],
        ["Active issuers", String(stats.activeIssuers)],
        ["Network", "Celo"],
        ["ERC-8004 identity", "#9229"],
      ]
    : [];

  return (
    <main className="stats-shell">
      <span className="section-kicker">PUBLIC OPERATIONS</span>
      <h1>Payflow stats</h1>
      <p>Live metrics reconstructed from the production Celo registry.</p>
      {error ? (
        <p className="inline-error">{error}</p>
      ) : !stats ? (
        <p>Loading Celo activity…</p>
      ) : (
        <section className="public-stats-grid">
          {metrics.map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </section>
      )}
      <p className="stats-note">
        Supported stablecoins: USDC, USDT, USDm ·{" "}
        <a href="https://8004scan.io/agents/celo/9229">View agent identity</a>
      </p>
    </main>
  );
}
