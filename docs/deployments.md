# Payflow Deployments

## Celo Mainnet

- Chain ID: `42220`
- Payflow Invoice Registry:
  [`0x572Db341b810D7981ADF73F50707084AF70568c0`](https://celo.blockscout.com/address/0x572Db341b810D7981ADF73F50707084AF70568c0)
- Deployment transaction:
  [`0x6c12a1f5e4e804debca0da39cee6a7ac61bb23296aa6d997422bf19519692e6e`](https://celo.blockscout.com/tx/0x6c12a1f5e4e804debca0da39cee6a7ac61bb23296aa6d997422bf19519692e6e)
- Deployment block: `69113706`
- Deployer and payment receiver:
  `0x84A768E1Bb51C57C5d9E8617fBFAA7eCCB44139d`

The registry source is verified on Celo Blockscout. Its immutable agent
operator can reconcile confirmed stablecoin transfers while invoice issuers
retain direct control over cancellation and payment updates.

The first registry deployment at
[`0xd904097e802D0fb8d8B065262FFdDb1eF6879F76`](https://celo.blockscout.com/address/0xd904097e802D0fb8d8B065262FFdDb1eF6879F76)
is verified but superseded.

## ERC-8004 Agent

- Agent ID: `9229`
- Profile: https://8004scan.io/agents/celo/9229
- Registration transaction:
  [`0x461fda67823e60637b0c3c3505abd39570631add2e152eff8e21e39785d76d80`](https://celo.blockscout.com/tx/0x461fda67823e60637b0c3c3505abd39570631add2e152eff8e21e39785d76d80)

## Autonomous Reconciliation Proof

The production agent completed an end-to-end mainnet test using a `0.01 USDC`
invoice:

- Invoice creation:
  [`0xdef958342570c91d31f7a5278a892be8418f1ac905e9adcb8238141561c4592f`](https://celo.blockscout.com/tx/0xdef958342570c91d31f7a5278a892be8418f1ac905e9adcb8238141561c4592f)
- Confirmed USDC transfer:
  [`0xa15a11a249b126d0b47abbdf056bbd6b994150870e1031bcdff83d06c8de3807`](https://celo.blockscout.com/tx/0xa15a11a249b126d0b47abbdf056bbd6b994150870e1031bcdff83d06c8de3807)
- Agent reconciliation:
  [`0x66e6574616b321a6832d94c794fcb2e38b0a9fe18e7f149ba8ddd13c07dd4950`](https://celo.blockscout.com/tx/0x66e6574616b321a6832d94c794fcb2e38b0a9fe18e7f149ba8ddd13c07dd4950)

The `InvoicePaid` event stores the USDC transfer hash as its payment reference.
