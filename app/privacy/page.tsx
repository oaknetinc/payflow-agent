import { LegalPage } from "@/components/LegalPage";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="June 9, 2026">
      <h2>What Payflow processes</h2>
      <p>
        Payflow processes invoice details you enter, public wallet addresses,
        and public Celo transaction data needed to create and confirm payment
        requests. Never enter sensitive personal information in an invoice.
      </p>
      <h2>Wallets and payments</h2>
      <p>
        Payflow is non-custodial. Payments move directly between wallet
        addresses through Celo. Payflow cannot reverse or recover a completed
        stablecoin transfer.
      </p>
      <h2>Storage</h2>
      <p>
        The prototype stores invoice drafts in the active browser session.
        Invoice hashes and transaction events may be permanently public when
        registered on Celo.
      </p>
      <h2>Contact</h2>
      <p>
        Privacy questions can be submitted through the support link in the
        application.
      </p>
    </LegalPage>
  );
}
