"use client";

import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Copy,
  FileCheck2,
  LoaderCircle,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { parseUnits } from "viem";
import { useMiniPay } from "@/hooks/useMiniPay";
import {
  Invoice,
  InvoiceDraft,
  InvoiceStatus,
  StablecoinSymbol,
} from "@/lib/types";
import { registerInvoiceOnchain } from "@/lib/invoiceRegistry";

const demoInvoices: Invoice[] = [
  {
    id: "INV-1042",
    client: "Acme Studio",
    email: "hello@acme.design",
    description: "Landing page design",
    amount: 450,
    currency: "USDC",
    dueDate: "Jun 12",
    status: "pending",
  },
  {
    id: "INV-1039",
    client: "Northstar Labs",
    email: "finance@northstar.dev",
    description: "Product strategy sprint",
    amount: 800,
    currency: "USDC",
    dueDate: "Jun 5",
    status: "paid",
  },
  {
    id: "INV-1037",
    client: "Kora Creative",
    email: "team@kora.africa",
    description: "Brand system",
    amount: 320,
    currency: "USDm",
    dueDate: "Jun 2",
    status: "overdue",
  },
];

const quickPrompts = [
  "Invoice Acme Studio $150 for a logo, due Friday",
  "Bill Kora Creative 300 USDC for June content",
  "Create a $500 invoice for Northstar, due in 7 days",
];

const statusMeta: Record<
  InvoiceStatus,
  { label: string; className: string }
> = {
  pending: { label: "Awaiting payment", className: "status-pending" },
  paid: { label: "Paid", className: "status-paid" },
  overdue: { label: "Overdue", className: "status-overdue" },
};

function formatMoney(amount: number, currency: StablecoinSymbol) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 ? 2 : 0,
  })
    .format(amount)
    .replace("$", currency === "USDm" ? "USDm " : "$");
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Home() {
  const { address, connect, isMiniPay, isLoading: walletLoading } = useMiniPay();
  const [prompt, setPrompt] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>(demoInvoices);
  const [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [toast, setToast] = useState("");

  const outstanding = useMemo(
    () =>
      invoices
        .filter((invoice) => invoice.status !== "paid")
        .reduce((sum, invoice) => sum + invoice.amount, 0),
    [invoices],
  );

  const paid = useMemo(
    () =>
      invoices
        .filter((invoice) => invoice.status === "paid")
        .reduce((sum, invoice) => sum + invoice.amount, 0),
    [invoices],
  );

  async function parseInvoice(event: FormEvent) {
    event.preventDefault();
    if (!prompt.trim()) return;

    setIsCreating(true);
    const response = await fetch("/api/invoices/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const parsed = (await response.json()) as InvoiceDraft;
    setDraft(parsed);
    setIsCreating(false);
  }

  async function createInvoice() {
    if (!draft) return;
    const nextInvoice: Invoice = {
      ...draft,
      id: `INV-${1043 + invoices.length}`,
      status: "pending",
    };
    setIsRegistering(true);
    try {
      if (address) {
        await registerInvoiceOnchain({
          invoice: nextInvoice,
          recipient: address,
        });
      }
      setInvoices((current) => [nextInvoice, ...current]);
      setSelected(nextInvoice);
      setDraft(null);
      setPrompt("");
      showToast(
        process.env.NEXT_PUBLIC_INVOICE_REGISTRY_ADDRESS && address
          ? "Invoice registered on Celo"
          : "Invoice created and ready to share",
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not create invoice",
      );
    } finally {
      setIsRegistering(false);
    }
  }

  async function copyPaymentLink(invoice: Invoice) {
    if (!address) {
      showToast("Connect your receiving wallet before sharing an invoice");
      return;
    }
    const params = new URLSearchParams({
      id: invoice.id,
      client: invoice.client,
      description: invoice.description,
      amount: String(invoice.amount),
      currency: invoice.currency,
      due: invoice.dueDate,
      recipient: address,
    });
    const link = `${window.location.origin}/pay?${params.toString()}`;
    await navigator.clipboard.writeText(link);
    showToast("Payment link copied");
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-mark">
            <CircleDollarSign size={21} strokeWidth={2.4} />
          </span>
          <span>Payflow</span>
          <span className="agent-pill">agent</span>
        </a>
        <button
          className="wallet-button"
          onClick={connect}
          disabled={walletLoading || Boolean(address)}
        >
          {walletLoading ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Wallet size={16} />
          )}
          {address
            ? shortAddress(address)
            : isMiniPay
              ? "Connecting..."
              : "Connect wallet"}
        </button>
      </header>

      <section className="hero">
        <div className="eyebrow">
          <Sparkles size={14} />
          Your onchain accounts assistant
        </div>
        <h1>Get paid without the chase.</h1>
        <p>
          Turn a sentence into a stablecoin invoice. Payflow follows up,
          confirms payment on Celo, and builds your reputation.
        </p>

        <form className="composer" onSubmit={parseInvoice}>
          <div className="composer-icon">
            <Sparkles size={20} />
          </div>
          <textarea
            aria-label="Describe an invoice"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder='Try: "Invoice Acme $150 for a logo, due Friday"'
            rows={2}
          />
          <button
            aria-label="Create invoice"
            className="send-button"
            disabled={!prompt.trim() || isCreating}
          >
            {isCreating ? (
              <LoaderCircle className="spin" size={19} />
            ) : (
              <ArrowRight size={19} />
            )}
          </button>
        </form>

        <div className="quick-prompts" aria-label="Example prompts">
          {quickPrompts.map((example) => (
            <button key={example} onClick={() => setPrompt(example)}>
              {example}
            </button>
          ))}
        </div>
      </section>

      <section className="dashboard">
        <div className="stats-grid">
          <article className="stat-card stat-primary">
            <span>Outstanding</span>
            <strong>${outstanding.toLocaleString()}</strong>
            <small>Across {invoices.filter((item) => item.status !== "paid").length} invoices</small>
          </article>
          <article className="stat-card">
            <span>Paid this month</span>
            <strong>${paid.toLocaleString()}</strong>
            <small className="positive">Onchain confirmed</small>
          </article>
          <article className="stat-card">
            <span>Agent reputation</span>
            <strong>92</strong>
            <small>ERC-8004 score</small>
          </article>
        </div>

        <div className="section-heading">
          <div>
            <span className="section-kicker">RECENT ACTIVITY</span>
            <h2>Your invoices</h2>
          </div>
          <button className="secondary-button" onClick={() => setPrompt("Invoice ")}>
            <Plus size={16} /> New invoice
          </button>
        </div>

        <div className="invoice-list">
          {invoices.map((invoice) => {
            const meta = statusMeta[invoice.status];
            return (
              <button
                className="invoice-row"
                key={invoice.id}
                onClick={() => setSelected(invoice)}
              >
                <span className="invoice-icon">
                  <FileCheck2 size={19} />
                </span>
                <span className="invoice-main">
                  <strong>{invoice.client}</strong>
                  <small>
                    {invoice.description} · {invoice.id}
                  </small>
                </span>
                <span className="invoice-due">
                  <small>Due</small>
                  <span>{invoice.dueDate}</span>
                </span>
                <span className="invoice-value">
                  <strong>{formatMoney(invoice.amount, invoice.currency)}</strong>
                  <span className={`status ${meta.className}`}>{meta.label}</span>
                </span>
                <ChevronRight className="row-chevron" size={18} />
              </button>
            );
          })}
        </div>
      </section>

      <section className="trust-strip">
        <div>
          <ShieldCheck size={20} />
          <span>
            <strong>Verified agent</strong>
            ERC-8004 identity
          </span>
        </div>
        <div>
          <CircleDollarSign size={20} />
          <span>
            <strong>Stablecoin native</strong>
            USDC and USDm on Celo
          </span>
        </div>
        <div>
          <Clock3 size={20} />
          <span>
            <strong>Always following up</strong>
            Automatic payment reminders
          </span>
        </div>
      </section>

      <footer>
        <span>Payflow Agent · Built on Celo</span>
        <nav>
          <Link href="/stats">Stats</Link>
          <Link href="/support">Support</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </footer>

      {draft && (
        <div className="modal-backdrop" onMouseDown={() => setDraft(null)}>
          <section
            className="modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setDraft(null)}>
              <X size={18} />
            </button>
            <span className="modal-icon">
              <Sparkles size={20} />
            </span>
            <span className="section-kicker">AGENT DRAFT</span>
            <h2>Ready to send</h2>
            <p>Payflow understood your request. Review the details below.</p>

            <div className="draft-card">
              <label>
                Client
                <input
                  value={draft.client}
                  onChange={(event) =>
                    setDraft({ ...draft, client: event.target.value })
                  }
                />
              </label>
              <label>
                Email
                <input
                  value={draft.email}
                  onChange={(event) =>
                    setDraft({ ...draft, email: event.target.value })
                  }
                  placeholder="client@example.com"
                />
              </label>
              <label className="wide-field">
                Work completed
                <input
                  value={draft.description}
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                />
              </label>
              <label>
                Amount
                <input
                  type="number"
                  value={draft.amount}
                  onChange={(event) =>
                    setDraft({ ...draft, amount: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Currency
                <select
                  value={draft.currency}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      currency: event.target.value as StablecoinSymbol,
                    })
                  }
                >
                  <option>USDC</option>
                  <option>USDT</option>
                  <option>USDm</option>
                </select>
              </label>
              <label className="wide-field">
                Due date
                <input
                  value={draft.dueDate}
                  onChange={(event) =>
                    setDraft({ ...draft, dueDate: event.target.value })
                  }
                />
              </label>
            </div>

            <button
              className="primary-button"
              onClick={createInvoice}
              disabled={isRegistering}
            >
              {isRegistering ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <ArrowRight size={17} />
              )}
              {isRegistering ? "Registering on Celo..." : "Create payment request"}
            </button>
          </section>
        </div>
      )}

      {selected && (
        <div className="modal-backdrop" onMouseDown={() => setSelected(null)}>
          <section
            className="modal invoice-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setSelected(null)}>
              <X size={18} />
            </button>
            <div className="invoice-brand">
              <span className="brand-mark">
                <CircleDollarSign size={19} />
              </span>
              Payflow
            </div>
            <div className="invoice-amount">
              <span>Payment request</span>
              <strong>{formatMoney(selected.amount, selected.currency)}</strong>
              <small>{selected.currency} on Celo</small>
            </div>
            <div className="invoice-details">
              <div>
                <span>From</span>
                <strong>Samuel O.</strong>
              </div>
              <div>
                <span>For</span>
                <strong>{selected.description}</strong>
              </div>
              <div>
                <span>Due</span>
                <strong>{selected.dueDate}</strong>
              </div>
              <div>
                <span>Invoice</span>
                <strong>{selected.id}</strong>
              </div>
            </div>

            {selected.status === "paid" ? (
              <div className="paid-banner">
                <Check size={18} /> Payment confirmed on Celo
              </div>
            ) : (
              <>
                <button
                  className="primary-button"
                  onClick={() => copyPaymentLink(selected)}
                >
                  <Copy size={17} /> Copy payment link
                </button>
                <button
                  className="text-button"
                  onClick={() =>
                    showToast(
                      `Prepared ${parseUnits(
                        String(selected.amount),
                        selected.currency === "USDC" ? 6 : 18,
                      )} base units`,
                    )
                  }
                >
                  <Send size={16} /> Preview onchain payment
                </button>
              </>
            )}
          </section>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
