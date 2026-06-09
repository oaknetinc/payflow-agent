import { LegalPage } from "@/components/LegalPage";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="June 9, 2026">
      <h2>Service</h2>
      <p>
        Payflow helps freelancers create stablecoin payment requests and view
        public settlement information on Celo. It does not provide banking,
        custody, lending, tax, or legal services.
      </p>
      <h2>Your responsibility</h2>
      <p>
        You are responsible for checking invoice details, recipient identity,
        stablecoin, amount, and destination before approving any transaction.
      </p>
      <h2>Final transactions</h2>
      <p>
        Blockchain transactions are generally irreversible. Payflow cannot
        cancel, refund, or recover funds sent to an incorrect address.
      </p>
      <h2>Availability</h2>
      <p>
        This hackathon release is provided as-is. We may update or suspend it
        to protect users, comply with law, or resolve critical defects.
      </p>
    </LegalPage>
  );
}
