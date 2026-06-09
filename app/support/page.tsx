import { LegalPage } from "@/components/LegalPage";

export default function SupportPage() {
  const email =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "payflow-agent@proton.me";
  return (
    <LegalPage title="Support" updated="June 9, 2026">
      <h2>Payment issue</h2>
      <p>
        Include the invoice ID and transaction hash. Never send a private key,
        recovery phrase, password, or verification code.
      </p>
      <h2>Response commitment</h2>
      <p>
        Funds-at-risk and payment-blocking reports are prioritized immediately.
        We aim to resolve critical MiniPay issues within 24 hours.
      </p>
      <a className="primary-button support-link" href={`mailto:${email}`}>
        Email Payflow support
      </a>
    </LegalPage>
  );
}
