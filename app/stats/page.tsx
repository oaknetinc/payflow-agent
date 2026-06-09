const metrics = [
  ["Invoices created", "0"],
  ["Payments confirmed", "0"],
  ["Stablecoin volume", "$0"],
  ["Unique payers", "0"],
  ["Failed payment rate", "0%"],
  ["Agent reputation", "Pending registration"],
];

export default function StatsPage() {
  return (
    <main className="stats-shell">
      <span className="section-kicker">PUBLIC OPERATIONS</span>
      <h1>Payflow stats</h1>
      <p>
        Transparent usage and onchain payment metrics. Values will populate
        from the deployed Celo registry at launch.
      </p>
      <section className="public-stats-grid">
        {metrics.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <p className="stats-note">
        Network: Celo · Supported stablecoins: USDC, USDT, USDm
      </p>
    </main>
  );
}
