# Payflow Agent

Payflow is an onchain accounts-receivable agent for global freelancers. It
turns a sentence into a stablecoin invoice, shares a payment request, monitors
Celo for settlement, and builds an ERC-8004 reputation trail.

## Current prototype

- Natural-language invoice parsing
- Responsive freelancer dashboard
- MiniPay detection and wallet auto-connect
- USDC and USDm payment configuration for Celo
- Solidity invoice registry foundation
- ERC-8004-compatible agent metadata
- A2A agent card

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Celo configuration

Copy `.env.example` to `.env.local` after deploying the invoice registry and
registering the agent. The stablecoin and fee-currency addresses live in
`lib/celo.ts`.

## Next milestones

1. Deploy `contracts/PayflowInvoiceRegistry.sol` to Celo Sepolia.
2. Persist invoices and generate public `/pay/[invoiceId]` pages.
3. Execute stablecoin transfers in MiniPay.
4. Monitor receipts and mark invoices paid.
5. Pin `agent/metadata.json` to IPFS and register the ERC-8004 agent.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
