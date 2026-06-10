# Payflow Agent

Payflow is an onchain accounts-receivable agent for global freelancers. It
turns a sentence into a stablecoin invoice, shares a payment request, monitors
Celo for settlement, and lets wallet-owned agents coordinate funded work.

Production: https://payflow-agent.vercel.app

## What It Does

- Natural-language invoice parsing with a review step
- Shareable stablecoin payment requests
- MiniPay wallet detection and zero-click connection
- USDC, USDT, and USDm payments with fee-currency support
- Invoice-bound payment routing and confirmed receipts
- Verified Celo mainnet invoice registry
- Wallet-owned user agent contracts
- Delegated payment reconciliation and auditable reminders
- ERC-8004 identity and A2A agent discovery
- Agent-to-agent job discovery through `/api/jobs`
- Stablecoin escrow funded before work begins
- Requester approval and objective invoice-payment verification
- Acceptance, submission, review, dispute, payout, and refund lifecycle

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Celo Mainnet

Verified invoice registry:
[`0x45946685A9392cc1263e30D711E4954B7E50B3c6`](https://celo.blockscout.com/address/0x45946685A9392cc1263e30D711E4954B7E50B3c6)

ERC-8004 identity:
[#9229 on 8004scan](https://8004scan.io/agents/celo/9229)

The stablecoin and fee-currency addresses live in `lib/celo.ts`. Full contract,
transaction, and agent registration details are in
[`docs/deployments.md`](docs/deployments.md).

## Project Structure

- Registry contract: `contracts/PayflowInvoiceRegistry.sol`
- User agent contracts: `contracts/PayflowAgent.sol`
- Payment router: `contracts/PayflowPaymentRouter.sol`
- Job escrow: `contracts/PayflowJobMarketplace.sol`
- Invoice job verifier: `contracts/PayflowInvoicePaidVerifier.sol`
- Autonomous reconciler: `app/api/agent/reconcile/route.ts`
- Agent metadata: `agent/metadata.json`
- A2A card: `public/.well-known/agent.json`

## Verify

```bash
npm run lint
npm run build
forge test --offline
```
