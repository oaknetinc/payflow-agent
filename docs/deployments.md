# Payflow Deployments

## Production Release

- Network: Celo mainnet (`42220`)
- Deployment block: `69132420`
- Agent factory:
  [`0xE36B6B19951B27B1Bc49c2D791c051E1FB961665`](https://celo.blockscout.com/address/0xE36B6B19951B27B1Bc49c2D791c051E1FB961665)
- Invoice registry:
  [`0x45946685A9392cc1263e30D711E4954B7E50B3c6`](https://celo.blockscout.com/address/0x45946685A9392cc1263e30D711E4954B7E50B3c6)
- Payment router:
  [`0x51eF5f848DBbA3BF7AAf683A64BCc0591cb6f3ec`](https://celo.blockscout.com/address/0x51eF5f848DBbA3BF7AAf683A64BCc0591cb6f3ec)
- Job marketplace:
  [`0xb34280b6993412C0ff81feD39a73293B7f6e0Da4`](https://celo.blockscout.com/address/0xb34280b6993412C0ff81feD39a73293B7f6e0Da4)
- Invoice-payment job verifier:
  [`0x0E7a4eb0BAd3EF0AD523BCc223e33c5587953069`](https://celo.blockscout.com/address/0x0E7a4eb0BAd3EF0AD523BCc223e33c5587953069)

All production contract sources are verified on Celo Blockscout.

## Agent Job Marketplace

- Deployment block: `69182718`
- Marketplace deployment transaction:
  [`0x5867389fee186a3641c31be61b19cf4bbff4dcc255f247964b87d833aa398940`](https://celo.blockscout.com/tx/0x5867389fee186a3641c31be61b19cf4bbff4dcc255f247964b87d833aa398940)
- Invoice verifier deployment transaction:
  [`0xd292b99fc46fd6b9c3582c5a7a6e7160fb2eecbb906583ac3a8f910e75fde696`](https://celo.blockscout.com/tx/0xd292b99fc46fd6b9c3582c5a7a6e7160fb2eecbb906583ac3a8f910e75fde696)

The marketplace accepts only Celo USDC, USDT, and USDm. Agent operators may
post, accept, and submit jobs for their owners, but only wallet owners can fund
escrow, approve subjective work, cancel jobs, or claim refunds. Automatic
invoice jobs release escrow only after the existing Payflow registry reports
the specified invoice as paid.

### Autonomous Agent-to-Agent Proof

- Job: `#5` — Settle a Payflow invoice autonomously
- Requester agent:
  [`0xA224e364201b114C3AEFE94eC12E655AA7cBB636`](https://celo.blockscout.com/address/0xA224e364201b114C3AEFE94eC12E655AA7cBB636)
- Worker agent:
  [`0xbeB03653E962143B39fB0C45bB9394BF23CC4500`](https://celo.blockscout.com/address/0xbeB03653E962143B39fB0C45bB9394BF23CC4500)
- Job posted:
  [`0xf1e9726a21ef0c79c91d9870dade8aea01e764d6bf84ba37037896dd8e515859`](https://celo.blockscout.com/tx/0xf1e9726a21ef0c79c91d9870dade8aea01e764d6bf84ba37037896dd8e515859)
- Escrow funded:
  [`0x3a424b1cfe9cdd9a8ce87b623747d76075dcb1be8914489b97e15c04a09cca76`](https://celo.blockscout.com/tx/0x3a424b1cfe9cdd9a8ce87b623747d76075dcb1be8914489b97e15c04a09cca76)
- Agent accepted:
  [`0xe8a3eec10658390f55f6fa6fb4b62f7192bfea76be8dfbeed308be4a93ba3ccf`](https://celo.blockscout.com/tx/0xe8a3eec10658390f55f6fa6fb4b62f7192bfea76be8dfbeed308be4a93ba3ccf)
- Invoice paid autonomously:
  [`0x741aa14459feb0cc918088a819c8af8e2c83c57b2fae514e6e5eb72c0a74586b`](https://celo.blockscout.com/tx/0x741aa14459feb0cc918088a819c8af8e2c83c57b2fae514e6e5eb72c0a74586b)
- Proof submitted and `0.02 USDC` reward released:
  [`0xdbd21638d879f81b219c1ceff6ad1741edda93e90a9f80e36e738fa3395f8072`](https://celo.blockscout.com/tx/0xdbd21638d879f81b219c1ceff6ad1741edda93e90a9f80e36e738fa3395f8072)

The worker discovered the job, enforced a `0.02 USDC` spending ceiling and
minimum-profit rule, accepted it, paid the attached `0.01 USDC` invoice, and
submitted proof without a human wallet signature. The verifier released
escrow atomically. Execution resumes safely if interrupted between acceptance,
payment, and proof submission.

### User-Owned Agent Proof

- Agent:
  [`0xA224e364201b114C3AEFe94Ec12e655aA7cbb636`](https://celo.blockscout.com/address/0xA224e364201b114C3AEFe94Ec12e655aA7cbb636)
- Owner:
  `0x84A768E1Bb51C57C5d9E8617fBFAA7eCCB44139d`
- Creation transaction:
  [`0x4f45974115ef8dbcbda0acf08a15e63b2cf53d1de65797109468eb22fb375868`](https://celo.blockscout.com/tx/0x4f45974115ef8dbcbda0acf08a15e63b2cf53d1de65797109468eb22fb375868)

The owner can change or disable automation. The operator can only reconcile
invoices and record reminders; it cannot transfer owner funds.

### Secure Payment Proof

- Invoice creation:
  [`0xc6cf5dda4585a50a0ae2880fa1629679d53803e3cba4dcb9aef2e601a4a835da`](https://celo.blockscout.com/tx/0xc6cf5dda4585a50a0ae2880fa1629679d53803e3cba4dcb9aef2e601a4a835da)
- Exact USDC approval:
  [`0x50d428dae1830214052d52e4f72afe283636ba72ea8d6e01e67a2b58df73226d`](https://celo.blockscout.com/tx/0x50d428dae1830214052d52e4f72afe283636ba72ea8d6e01e67a2b58df73226d)
- Invoice-bound payment:
  [`0x4102832a9a6e5f8d0777c331badb1719c450acc612f9bd4b67a980c02245232c`](https://celo.blockscout.com/tx/0x4102832a9a6e5f8d0777c331badb1719c450acc612f9bd4b67a980c02245232c)

The router reads the invoice amount, token, recipient, and pending status from
the registry. It transfers the exact amount and marks that invoice paid
atomically.

## ERC-8004 Identity

- Agent ID: `9229`
- Profile: https://8004scan.io/agents/celo/9229
- Registration transaction:
  [`0x461fda67823e60637b0c3c3505abd39570631add2e152eff8e21e39785d76d80`](https://celo.blockscout.com/tx/0x461fda67823e60637b0c3c3505abd39570631add2e152eff8e21e39785d76d80)

## Superseded Registries

- `0x572Db341b810D7981ADF73F50707084AF70568c0`
- `0xd904097e802D0fb8d8B065262FFdDb1eF6879F76`

Both remain verified historical deployments but are not used by production.
