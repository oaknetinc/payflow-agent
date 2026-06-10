"use client";

/* eslint-disable @next/next/no-img-element */

import {
  ArrowLeft,
  Check,
  CircleDollarSign,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { payStablecoinInvoice } from "@/lib/payments";
import { Invoice } from "@/lib/types";
import { useMiniPay } from "@/hooks/useMiniPay";
import { useStablecoinBalances } from "@/hooks/useStablecoinBalances";
import { loadInvoice } from "@/lib/invoiceRegistry";

export function PaymentCheckout() {
  const params = useSearchParams();
  const invoiceKey = params.get("id") as `0x${string}` | null;
  const validInvoiceKey = Boolean(
    invoiceKey && /^0x[a-fA-F0-9]{64}$/.test(invoiceKey),
  );
  const { address, connect, isMiniPay, isLoading, error: walletError } =
    useMiniPay();
  const { balances, preferred, isLoading: balancesLoading } =
    useStablecoinBalances(address);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [status, setStatus] = useState<
    "loading" | "idle" | "paying" | "confirmed" | "error"
  >(validInvoiceKey ? "loading" : "error");
  const [message, setMessage] = useState(
    validInvoiceKey ? "" : "This payment link is invalid.",
  );

  useEffect(() => {
    if (!invoiceKey || !validInvoiceKey) return;
    void loadInvoice(invoiceKey)
      .then((value) => {
        setInvoice(value);
        setStatus("idle");
      })
      .catch((cause) => {
        setMessage(cause instanceof Error ? cause.message : "Invoice unavailable.");
        setStatus("error");
      });
  }, [invoiceKey, validInvoiceKey]);

  async function pay() {
    if (!invoice) return;
    if (!address) {
      await connect();
      return;
    }
    if (invoice.status === "paid") {
      setMessage("This invoice has already been paid.");
      setStatus("error");
      return;
    }
    if (invoice.status === "cancelled") {
      setMessage("This invoice was cancelled.");
      setStatus("error");
      return;
    }

    setStatus("paying");
    setMessage("");
    try {
      if (balances[invoice.currency] < invoice.amount) {
        window.location.href =
          "https://link.minipay.xyz/add_cash?tokens=USDm,USDC,USDT";
        return;
      }
      const { hash } = await payStablecoinInvoice({
        invoiceKey: invoice.key,
        amount: String(invoice.amount),
        currency: invoice.currency,
      });
      setMessage(hash);
      setStatus("confirmed");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Payment failed.");
      setStatus("error");
    }
  }

  if (status === "loading") {
    return (
      <main className="checkout-shell">
        <div className="checkout-loading">
          <LoaderCircle className="spin" size={24} /> Loading onchain invoice
        </div>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="checkout-shell">
        <section className="checkout-card checkout-error-card">
          <h1>Invoice unavailable</h1>
          <p>{message}</p>
          <Link className="primary-button" href="/">
            Back to Payflow
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="checkout-shell">
      <nav className="checkout-nav">
        <Link href="/">
          <ArrowLeft size={17} /> Back
        </Link>
        <span>
          <LockKeyhole size={13} /> Verified Celo invoice
        </span>
      </nav>

      <section className="checkout-card">
        <div className="invoice-brand">
          <span className="brand-mark">
            <CircleDollarSign size={19} />
          </span>
          Payflow
        </div>

        {status === "confirmed" ? (
          <div className="checkout-success">
            <img
              className="checkout-success-art"
              src="/art/payment-confirmed.webp"
              alt="Payment delivered through Payflow"
              width="640"
              height="640"
            />
            <h1>Payment confirmed</h1>
            <p>The stablecoin transfer was confirmed on Celo.</p>
            <a
              href={`https://celo.blockscout.com/tx/${message}`}
              target="_blank"
              rel="noreferrer"
            >
              View transaction
            </a>
            <Link className="primary-button" href="/">
              Done
            </Link>
          </div>
        ) : (
          <>
            <div className="checkout-title">
              <span>Invoice from {invoice.issuer.slice(0, 8)}…</span>
              <h1>
                {invoice.currency === "USDm" ? "USDm " : "$"}
                {invoice.amount}
              </h1>
              <p>{invoice.currency} on Celo</p>
              {address && preferred !== invoice.currency && (
                <small className="preferred-note">
                  Your largest balance is {preferred}. This invoice requires{" "}
                  {invoice.currency}.
                </small>
              )}
            </div>

            <div className="checkout-details">
              <div>
                <span>Service</span>
                <strong>{invoice.description}</strong>
              </div>
              <div>
                <span>Invoice</span>
                <strong>{invoice.id}</strong>
              </div>
              <div>
                <span>Client</span>
                <strong>{invoice.client}</strong>
              </div>
              <div>
                <span>Due</span>
                <strong>{invoice.dueDate}</strong>
              </div>
            </div>

            {!isMiniPay && (
              <div className="checkout-notice">
                <Wallet size={18} />
                <span>
                  <strong>MiniPay-ready</strong>
                  Open this verified request inside MiniPay to pay.
                </span>
              </div>
            )}

            {(status === "error" || walletError) && (
              <p className="payment-error">{message || walletError}</p>
            )}

            <button
              className="primary-button"
              onClick={pay}
              disabled={
                isLoading ||
                balancesLoading ||
                status === "paying" ||
                invoice.status === "paid" ||
                invoice.status === "cancelled"
              }
            >
              {isLoading || balancesLoading || status === "paying" ? (
                <LoaderCircle className="spin" size={18} />
              ) : invoice.status === "paid" ? (
                <Check size={17} />
              ) : (
                <Wallet size={17} />
              )}
              {invoice.status === "paid"
                ? "Already paid"
                : address
                  ? `Pay ${invoice.amount} ${invoice.currency}`
                  : "Connect to pay"}
            </button>

            <div className="checkout-security">
              <ShieldCheck size={15} />
              Amount, token, recipient, and status were loaded from the verified
              Payflow registry. Funds settle directly to the issuer.
            </div>
          </>
        )}
      </section>
    </main>
  );
}
