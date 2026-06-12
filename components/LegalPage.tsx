import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="legal-shell">
      <Link href="/" className="legal-back">
        <ArrowLeft size={16} /> Back to Payflow
      </Link>
      <article className="legal-card">
        <div className="invoice-brand">
          <BrandLogo compact />
        </div>
        <h1>{title}</h1>
        <p className="legal-updated">Last updated {updated}</p>
        <div className="legal-content">{children}</div>
      </article>
    </main>
  );
}
