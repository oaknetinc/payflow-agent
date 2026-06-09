# Payflow Agent

Payflow is an onchain accounts-receivable agent for global freelancers. It
turns a sentence into a stablecoin invoice, shares a payment request, monitors
Celo for settlement, and builds an ERC-8004 reputation trail.

Production: https://payflow-agent.vercel.app

## What It Does

- Natural-language invoice parsing
- Shareable stablecoin payment requests
- MiniPay wallet detection and zero-click connection
- USDC, USDT, and USDm payments with fee-currency support
- Confirmed-receipt payment handling
- Verified Celo mainnet invoice registry
- Autonomous payment reconciliation by the Payflow agent
- ERC-8004 identity and A2A agent discovery

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Celo Mainnet

Verified invoice registry:
[`0x572Db341b810D7981ADF73F50707084AF70568c0`](https://celo.blockscout.com/address/0x572Db341b810D7981ADF73F50707084AF70568c0)

ERC-8004 identity:
[#9229 on 8004scan](https://8004scan.io/agents/celo/9229)

The stablecoin and fee-currency addresses live in `lib/celo.ts`. Full contract,
transaction, and agent registration details are in
[`docs/deployments.md`](docs/deployments.md).

## Project Structure

- Registry contract: `contracts/PayflowInvoiceRegistry.sol`
- Autonomous reconciler: `app/api/agent/reconcile/route.ts`
- Agent metadata: `agent/metadata.json`
- A2A card: `public/.well-known/agent.json`

## Verify

```bash
npm run lint
npm run build
forge test --offline
```
