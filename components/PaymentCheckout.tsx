"use client";

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
import { useState } from "react";
import { payStablecoin } from "@/lib/payments";
import { StablecoinSymbol } from "@/lib/types";
import { useMiniPay } from "@/hooks/useMiniPay";
import { useStablecoinBalances } from "@/hooks/useStablecoinBalances";

export function PaymentCheckout() {
  const params = useSearchParams();
  const { address, connect, isMiniPay, isLoading } = useMiniPay();
  const { balances, preferred, isLoading: balancesLoading } =
    useStablecoinBalances(address);
  const [status, setStatus] = useState<
    "idle" | "paying" | "confirmed" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const invoice = {
    id: params.get("id") ?? "INV-DEMO",
    client: params.get("client") ?? "Payflow client",
    description: params.get("description") ?? "Freelance services",
    amount: params.get("amount") ?? "150",
    currency: (params.get("currency") ?? "USDC") as StablecoinSymbol,
    due: params.get("due") ?? "Today",
    recipient:
      params.get("recipient") ??
      process.env.NEXT_PUBLIC_PAYFLOW_RECIPIENT ??
      "",
  };

  async function pay() {
    if (!address) {
      await connect();
      return;
    }

    setStatus("paying");
    setMessage("");
    try {
      if (!/^0x[a-fA-F0-9]{40}$/.test(invoice.recipient)) {
        throw new Error(
          "This invoice is missing a valid recipient. Ask the freelancer for a new payment link.",
        );
      }
      if (balances[invoice.currency] < Number(invoice.amount)) {
        window.location.href =
          "https://link.minipay.xyz/add_cash?tokens=USDm,USDC,USDT";
        return;
      }
      const { hash } = await payStablecoin({
        amount: invoice.amount,
        currency: invoice.currency,
        recipient: invoice.recipient as `0x${string}`,
      });
      setMessage(`${hash.slice(0, 10)}...${hash.slice(-8)}`);
      setStatus("confirmed");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment failed");
      setStatus("error");
    }
  }

  return (
    <main className="checkout-shell">
      <nav className="checkout-nav">
        <Link href="/">
          <ArrowLeft size={17} /> Back
        </Link>
        <span>
          <LockKeyhole size={13} /> Secure Celo checkout
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
            <span>
              <Check size={28} />
            </span>
            <h1>Payment sent</h1>
            <p>Your stablecoin transfer was submitted to Celo.</p>
            <code>{message}</code>
            <Link className="primary-button" href="/">
              Done
            </Link>
          </div>
        ) : (
          <>
            <div className="checkout-title">
              <span>Invoice from Samuel O.</span>
              <h1>
                {invoice.currency === "USDm" ? "USDm " : "$"}
                {invoice.amount}
              </h1>
              <p>{invoice.currency} on Celo</p>
              {address && preferred !== invoice.currency && (
                <small className="preferred-note">
                  Your largest balance is {preferred}. This request specifically
                  accepts {invoice.currency}.
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
                <strong>{invoice.due}</strong>
              </div>
            </div>

            {!isMiniPay && (
              <div className="checkout-notice">
                <Wallet size={18} />
                <span>
                  <strong>MiniPay-ready</strong>
                  Open this link inside MiniPay to pay with stablecoins.
                </span>
              </div>
            )}

            {status === "error" && <p className="payment-error">{message}</p>}

            <button
              className="primary-button"
              onClick={pay}
              disabled={isLoading || balancesLoading || status === "paying"}
            >
              {isLoading || balancesLoading || status === "paying" ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Wallet size={17} />
              )}
              {address ? `Pay ${invoice.amount} ${invoice.currency}` : "Connect to pay"}
            </button>

            <div className="checkout-security">
              <ShieldCheck size={15} />
              Payment settles directly to the freelancer. Payflow never holds
              your funds.
            </div>
          </>
        )}
      </section>
    </main>
  );
}
