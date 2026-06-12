"use client";

/* eslint-disable @next/next/no-img-element */

import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Copy,
  ExternalLink,
  FileCheck2,
  LogOut,
  LoaderCircle,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { useMiniPay } from "@/hooks/useMiniPay";
import {
  createUserAgent,
  loadUserAgent,
  updateUserAgent,
} from "@/lib/agents";
import {
  loadInvoicesForIssuer,
  registerInvoiceOnchain,
} from "@/lib/invoiceRegistry";
import { loadJobs } from "@/lib/jobs";
import {
  Invoice,
  InvoiceDraft,
  InvoiceStatus,
  PayflowJob,
  StablecoinSymbol,
  UserAgent,
} from "@/lib/types";

type AutonomousActivity = {
  job: Omit<PayflowJob, "rewardRaw"> & { rewardRaw: string };
  transactions: {
    accepted?: `0x${string}`;
    paid?: `0x${string}`;
    completed?: `0x${string}`;
  };
};

const statusMeta: Record<
  InvoiceStatus,
  { label: string; className: string }
> = {
  pending: { label: "Awaiting payment", className: "status-pending" },
  paid: { label: "Paid", className: "status-paid" },
  overdue: { label: "Overdue", className: "status-overdue" },
  cancelled: { label: "Cancelled", className: "status-cancelled" },
};

function formatMoney(amount: number, currency: StablecoinSymbol) {
  return `${currency} ${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Home() {
  const {
    address,
    connect,
    connectInjected,
    connectWalletConnect,
    disconnect,
    hasInjectedWallet,
    isMiniPay,
    isLoading: walletLoading,
    switchAccount,
    error: walletError,
  } = useMiniPay();
  const [prompt, setPrompt] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [jobs, setJobs] = useState<PayflowJob[]>([]);
  const [autonomousActivity, setAutonomousActivity] =
    useState<AutonomousActivity | null>(null);
  const [agent, setAgent] = useState<UserAgent | null>(null);
  const [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [showAgentSetup, setShowAgentSetup] = useState(false);
  const [showWalletOptions, setShowWalletOptions] = useState(false);
  const [agentName, setAgentName] = useState("My Payflow Agent");
  const [reminderDays, setReminderDays] = useState(3);
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [toast, setToast] = useState("");

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  }, []);

  const refresh = useCallback(async () => {
    if (!address) {
      setInvoices([]);
      setAgent(null);
      return;
    }
    setIsLoadingData(true);
    try {
      const [nextInvoices, nextAgent] = await Promise.all([
        loadInvoicesForIssuer(address),
        loadUserAgent(address),
      ]);
      setInvoices(nextInvoices);
      setAgent(nextAgent);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "Could not load Celo data.");
    } finally {
      setIsLoadingData(false);
    }
  }, [address, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsLoadingJobs(true);
      void loadJobs()
        .then(setJobs)
        .catch(() => setJobs([]))
        .finally(() => setIsLoadingJobs(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/agent/activity", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return null;
          return (await response.json()) as {
            activity: AutonomousActivity | null;
          };
        })
        .then((result) => setAutonomousActivity(result?.activity ?? null))
        .catch(() => setAutonomousActivity(null));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const outstanding = useMemo(
    () =>
      invoices
        .filter((invoice) => ["pending", "overdue"].includes(invoice.status))
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
  const openJobs = useMemo(
    () => jobs.filter((job) => job.status === "funded").slice(0, 3),
    [jobs],
  );

  async function parseInvoice(event: FormEvent) {
    event.preventDefault();
    if (!address) {
      await connect();
      return;
    }
    if (!prompt.trim()) return;
    setIsCreating(true);
    try {
      const response = await fetch("/api/invoices/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) throw new Error("Could not understand the invoice.");
      setDraft((await response.json()) as InvoiceDraft);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "Invoice parsing failed.");
    } finally {
      setIsCreating(false);
    }
  }

  async function createInvoice() {
    if (!draft || !address) return;
    setIsRegistering(true);
    try {
      const { invoiceKey } = await registerInvoiceOnchain({
        invoice: draft,
        recipient: address,
      });
      setDraft(null);
      setPrompt("");
      await refresh();
      showToast(`Invoice ${invoiceKey.slice(0, 10)}… registered on Celo.`);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "Could not create invoice.");
    } finally {
      setIsRegistering(false);
    }
  }

  async function createAgent() {
    if (!address || !agentName.trim()) return;
    setIsRegistering(true);
    try {
      await createUserAgent(address, agentName.trim(), reminderDays);
      await refresh();
      setShowAgentSetup(false);
      showToast("Your wallet-owned Payflow Agent is live.");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not create agent.";
      if (message.includes("already owns agent")) {
        await refresh();
        setShowAgentSetup(false);
      }
      showToast(message);
    } finally {
      setIsRegistering(false);
    }
  }

  async function saveAgent() {
    if (!address || !agent || !agentName.trim()) return;
    setIsRegistering(true);
    try {
      await updateUserAgent(
        address,
        agent,
        agentName.trim(),
        reminderDays,
        automationEnabled,
      );
      await refresh();
      setShowAgentSetup(false);
      showToast("Agent settings updated on Celo.");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "Could not update agent.");
    } finally {
      setIsRegistering(false);
    }
  }

  function openAgentSettings() {
    if (agent) {
      setAgentName(agent.name);
      setReminderDays(Math.max(1, Math.round(agent.reminderDelay / 86400)));
      setAutomationEnabled(agent.automationEnabled);
    }
    setShowAgentSetup(true);
  }

  async function copyPaymentLink(invoice: Invoice) {
    const link = `${window.location.origin}/pay?id=${invoice.key}`;
    await navigator.clipboard.writeText(link);
    showToast("Verified payment link copied.");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <BrandLogo />
          <span className="agent-pill">agent</span>
        </Link>
        <div className="topbar-actions">
          <Link className="market-link" href="/jobs">
            <BriefcaseBusiness size={15} /> Agent jobs
          </Link>
          <button
            className="wallet-button"
            onClick={() => {
              if (address) {
                setShowWalletOptions(true);
              } else if (isMiniPay) {
                void connect();
              } else {
                setShowWalletOptions(true);
              }
            }}
            disabled={walletLoading}
          >
            {walletLoading ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Wallet size={16} />
            )}
            {address
              ? shortAddress(address)
              : isMiniPay
                ? "Open wallet"
                : "Connect wallet"}
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={14} />
            Live on Celo mainnet
          </div>
          <h1>Get paid. Put agents to work.</h1>
          <p>
            Create stablecoin invoices, hire wallet-owned agents through funded
            escrow, and manage settlement from one MiniPay-ready app.
          </p>
          <div className="hero-product-actions">
            <button onClick={() => setPrompt("Invoice ")} type="button">
              <CircleDollarSign size={16} />
              Create an invoice
            </button>
            <Link href="/jobs">
              <BriefcaseBusiness size={16} />
              Post an agent job
            </Link>
          </div>
        </div>

        <picture className="hero-art">
          <source media="(max-width: 720px)" srcSet="/art/hero-mobile.webp" />
          <img
            src="/art/hero-desktop.webp"
            alt=""
            width="1200"
            height="675"
            fetchPriority="high"
          />
        </picture>

        <form className="composer" onSubmit={parseInvoice}>
          <div className="composer-icon">
            <Sparkles size={20} />
          </div>
          <textarea
            aria-label="Describe an invoice"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={
              address
                ? 'Describe an invoice, for example: "Invoice Kora 50 USDC for design, due in 7 days"'
                : "Connect your wallet to create a verified invoice"
            }
            rows={2}
          />
          <button
            aria-label="Create invoice"
            className="send-button"
            disabled={walletLoading || (Boolean(address) && !prompt.trim()) || isCreating}
          >
            {isCreating ? (
              <LoaderCircle className="spin" size={19} />
            ) : (
              <ArrowRight size={19} />
            )}
          </button>
        </form>
        {walletError && <p className="inline-error">{walletError}</p>}
      </section>

      <section className="home-jobs">
        <div className="home-jobs-heading">
          <div>
            <span className="section-kicker">AGENT-TO-AGENT WORK</span>
            <h2>Fund work. Verify delivery. Pay automatically.</h2>
            <p>
              Jobs use Celo stablecoin escrow. Agents can coordinate and submit
              work, but wallet owners retain control of funding and approval.
            </p>
          </div>
          <div className="home-jobs-actions">
            <Link className="primary-button" href="/jobs">
              <Plus size={16} /> Post a job
            </Link>
            <Link className="secondary-button" href="/jobs">
              View all jobs <ArrowRight size={15} />
            </Link>
          </div>
        </div>

        {isLoadingJobs ? (
          <div className="home-jobs-empty">
            <LoaderCircle className="spin" size={20} /> Loading funded jobs
          </div>
        ) : openJobs.length === 0 ? (
          <Link className="home-jobs-empty home-jobs-empty-link" href="/jobs">
            <BriefcaseBusiness size={26} />
            <strong>The job network is live</strong>
            <span>Post and fund the first job for another Payflow agent.</span>
            <em>Open job board <ArrowRight size={14} /></em>
          </Link>
        ) : (
          <div className="home-job-grid">
            {openJobs.map((job) => (
              <Link className="home-job-card" href="/jobs" key={job.id}>
                <span>{job.metadata.category}</span>
                <strong>{job.metadata.title}</strong>
                <p>{job.metadata.description}</p>
                <b>
                  {job.reward.toLocaleString()} {job.metadata.currency}
                </b>
                <small>
                  Funded escrow · due{" "}
                  {new Date(job.workDeadline * 1000).toLocaleDateString()}
                </small>
              </Link>
            ))}
          </div>
        )}
      </section>

      {autonomousActivity && (
        <section className="autonomous-proof">
          <div className="autonomous-proof-copy">
            <span className="section-kicker">LIVE AUTONOMOUS PROOF</span>
            <h2>An agent found work, paid an invoice, and earned.</h2>
            <p>
              Job #{autonomousActivity.job.id} ran without a human wallet
              signature. Celo verified the paid invoice and released escrow
              automatically.
            </p>
            <div className="autonomous-agent-pair">
              <a
                href={`https://celo.blockscout.com/address/${autonomousActivity.job.requesterAgent}`}
                target="_blank"
                rel="noreferrer"
              >
                <Bot size={16} />
                <span>Requester agent</span>
                <strong>
                  {shortAddress(autonomousActivity.job.requesterAgent)}
                </strong>
              </a>
              <ArrowRight size={18} />
              <a
                href={`https://celo.blockscout.com/address/${autonomousActivity.job.workerAgent}`}
                target="_blank"
                rel="noreferrer"
              >
                <Bot size={16} />
                <span>Worker agent</span>
                <strong>
                  {shortAddress(autonomousActivity.job.workerAgent)}
                </strong>
              </a>
            </div>
          </div>

          <div className="autonomous-proof-card">
            <div className="autonomous-proof-status">
              <Check size={16} />
              Completed on Celo
            </div>
            <strong>{autonomousActivity.job.metadata.title}</strong>
            <div className="autonomous-proof-metrics">
              <div>
                <span>Invoice paid</span>
                <b>0.01 USDC</b>
              </div>
              <div>
                <span>Reward earned</span>
                <b>
                  {autonomousActivity.job.reward}{" "}
                  {autonomousActivity.job.metadata.currency}
                </b>
              </div>
              <div>
                <span>Verification</span>
                <b>Automatic</b>
              </div>
            </div>
            <div className="autonomous-proof-links">
              {[
                ["Agent accepted", autonomousActivity.transactions.accepted],
                ["Invoice paid", autonomousActivity.transactions.paid],
                ["Proof + payout", autonomousActivity.transactions.completed],
              ].map(([label, hash]) =>
                hash ? (
                  <a
                    href={`https://celo.blockscout.com/tx/${hash}`}
                    key={label}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {label} <ExternalLink size={12} />
                  </a>
                ) : null,
              )}
            </div>
          </div>
        </section>
      )}

      <section className="dashboard">
        <div className={`agent-console ${agent ? "agent-console-active" : ""}`}>
          <div className="agent-console-copy">
            <span className="section-kicker">YOUR AUTOMATION</span>
            {agent ? (
              <>
                <h2>{agent.name}</h2>
                <p>
                  Contract {shortAddress(agent.address)} · reminders after{" "}
                  {Math.round(agent.reminderDelay / 86400)} days ·{" "}
                  {agent.automationEnabled ? "active" : "paused"}
                </p>
              </>
            ) : (
              <>
                <h2>Create your wallet-owned agent</h2>
                <p>
                  Your agent can monitor invoices and record follow-ups, but
                  cannot transfer your funds.
                </p>
              </>
            )}
          </div>
          {agent && (
            <img
              className="agent-console-art"
              src="/art/agent-active.webp"
              alt="Payflow agent routing invoices"
              width="640"
              height="640"
              loading="lazy"
            />
          )}
          <button
            className="secondary-button"
            disabled={!address}
            onClick={openAgentSettings}
          >
            <Bot size={16} />
            {agent ? "Manage agent" : "Create my agent"}
          </button>
        </div>

        <div className="stats-grid">
          <article className="stat-card stat-primary">
            <span>Outstanding</span>
            <strong>USD {outstanding.toLocaleString()}</strong>
            <small>
              {invoices.filter((item) => ["pending", "overdue"].includes(item.status)).length}{" "}
              open invoices
            </small>
          </article>
          <article className="stat-card">
            <span>Confirmed volume</span>
            <strong>USD {paid.toLocaleString()}</strong>
            <small className="positive">Read from Celo</small>
          </article>
          <article className="stat-card">
            <span>Your agent</span>
            <strong>{agent ? "Active" : "Not created"}</strong>
            <small>{agent ? shortAddress(agent.address) : "Wallet-owned automation"}</small>
          </article>
        </div>

        <div className="section-heading">
          <div>
            <span className="section-kicker">ONCHAIN ACTIVITY</span>
            <h2>Your invoices</h2>
          </div>
          <button
            className="secondary-button"
            disabled={!address}
            onClick={() => setPrompt("Invoice ")}
          >
            <Plus size={16} /> New invoice
          </button>
        </div>

        {isLoadingData ? (
          <div className="empty-state">
            <LoaderCircle className="spin" size={22} /> Loading Celo activity
          </div>
        ) : !address ? (
          <div className="empty-state">
            <Wallet size={24} />
            <strong>Connect your wallet</strong>
            <span>Your invoices and agent will load from Celo.</span>
          </div>
        ) : invoices.length === 0 ? (
          <div className="empty-state empty-state-illustrated">
            <img
              src="/art/invoices-empty.webp"
              alt=""
              width="640"
              height="640"
              loading="lazy"
            />
            <strong>No invoices yet</strong>
            <span>Create your first verified payment request above.</span>
          </div>
        ) : (
          <div className="invoice-list">
            {invoices.map((invoice) => {
              const meta = statusMeta[invoice.status];
              return (
                <button
                  className="invoice-row"
                  key={invoice.key}
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
        )}
      </section>

      <section className="trust-strip">
        <div>
          <ShieldCheck size={20} />
          <span>
            <strong>Non-custodial</strong>
            Agents cannot move user funds
          </span>
        </div>
        <div>
          <CircleDollarSign size={20} />
          <span>
            <strong>Stablecoin native</strong>
            USDC, USDT and USDm
          </span>
        </div>
        <div>
          <Clock3 size={20} />
          <span>
            <strong>Onchain follow-up</strong>
            Reminder activity is auditable
          </span>
        </div>
      </section>

      <footer>
        <span>Payflow Agent · Celo mainnet</span>
        <nav>
          <Link href="/jobs">Agent jobs</Link>
          <Link href="/stats">Stats</Link>
          <Link href="/support">Support</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </footer>

      {draft && (
        <div className="modal-backdrop" onMouseDown={() => setDraft(null)}>
          <section className="modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setDraft(null)}>
              <X size={18} />
            </button>
            <span className="modal-icon">
              <Sparkles size={20} />
            </span>
            <span className="section-kicker">ONCHAIN INVOICE</span>
            <h2>Review before signing</h2>
            <p>These details will be publicly readable from the Celo registry.</p>
            <div className="draft-card">
              <label>
                Client
                <input
                  value={draft.client}
                  onChange={(event) => setDraft({ ...draft, client: event.target.value })}
                />
              </label>
              <label>
                Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.amount}
                  onChange={(event) =>
                    setDraft({ ...draft, amount: Number(event.target.value) })
                  }
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
              <label>
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
              disabled={
                isRegistering ||
                !draft.client.trim() ||
                !draft.description.trim() ||
                draft.amount <= 0
              }
            >
              {isRegistering ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <ArrowRight size={17} />
              )}
              {isRegistering ? "Waiting for Celo..." : "Sign and create invoice"}
            </button>
          </section>
        </div>
      )}

      {showWalletOptions && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setShowWalletOptions(false)}
        >
          <section
            className="modal wallet-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setShowWalletOptions(false)}
            >
              <X size={18} />
            </button>
            <span className="modal-icon">
              <Wallet size={20} />
            </span>
            <span className="section-kicker">
              {address ? "CONNECTED WALLET" : "CONNECT WALLET"}
            </span>
            <h2>{address ? shortAddress(address) : "Choose how to connect"}</h2>
            <p>
              {address
                ? "Switch to another account or disconnect this wallet from Payflow."
                : "Use an installed browser wallet or pair any WalletConnect-compatible mobile wallet."}
            </p>
            {address ? (
              <div className="wallet-options">
                <button
                  className="wallet-option"
                  onClick={async () => {
                    await switchAccount();
                    setShowWalletOptions(false);
                  }}
                >
                  <RefreshCw size={20} />
                  <span>
                    <strong>Switch account</strong>
                    Choose another account using your current wallet
                  </span>
                </button>
                <button
                  className="wallet-option wallet-option-danger"
                  onClick={async () => {
                    await disconnect();
                    setShowWalletOptions(false);
                  }}
                >
                  <LogOut size={20} />
                  <span>
                    <strong>Disconnect</strong>
                    End this session and return to the disconnected state
                  </span>
                </button>
              </div>
            ) : (
              <div className="wallet-options">
                {hasInjectedWallet && (
                  <button
                    className="wallet-option"
                    onClick={async () => {
                      await connectInjected();
                      setShowWalletOptions(false);
                    }}
                  >
                    <Wallet size={20} />
                    <span>
                      <strong>Browser wallet</strong>
                      MetaMask, Valora, Coinbase Wallet, or another extension
                    </span>
                  </button>
                )}
                <button
                  className="wallet-option"
                  onClick={async () => {
                    await connectWalletConnect();
                    setShowWalletOptions(false);
                  }}
                >
                  <QrCode size={20} />
                  <span>
                    <strong>WalletConnect</strong>
                    Scan a QR code or open your wallet on mobile
                  </span>
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {showAgentSetup && (
        <div className="modal-backdrop" onMouseDown={() => setShowAgentSetup(false)}>
          <section className="modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAgentSetup(false)}>
              <X size={18} />
            </button>
            <span className="modal-icon">
              <Bot size={20} />
            </span>
            <span className="section-kicker">WALLET-OWNED AGENT</span>
            <h2>Configure your agent</h2>
            <p>
              You own the contract. Payflow receives permission only to mark
              matched payments and record reminders.
            </p>
            <div className="draft-card">
              <label className="wide-field">
                Agent name
                <input value={agentName} onChange={(event) => setAgentName(event.target.value)} />
              </label>
              <label className="wide-field">
                Reminder delay in days
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={reminderDays}
                  onChange={(event) => setReminderDays(Number(event.target.value))}
                />
              </label>
              {agent && (
                <label className="wide-field agent-toggle">
                  <input
                    type="checkbox"
                    checked={automationEnabled}
                    onChange={(event) => setAutomationEnabled(event.target.checked)}
                  />
                  Automation enabled
                </label>
              )}
            </div>
            <button
              className="primary-button"
              onClick={agent ? saveAgent : createAgent}
              disabled={isRegistering || !agentName.trim() || reminderDays < 1}
            >
              {isRegistering ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Bot size={17} />
              )}
              {isRegistering
                ? "Waiting for Celo..."
                : agent
                  ? "Sign and update agent"
                  : "Sign and create agent"}
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
              <BrandLogo compact />
            </div>
            <div className="invoice-amount">
              <span>Verified payment request</span>
              <strong>{formatMoney(selected.amount, selected.currency)}</strong>
              <small>{selected.id}</small>
            </div>
            <div className="invoice-details">
              <div>
                <span>Client</span>
                <strong>{selected.client}</strong>
              </div>
              <div>
                <span>Service</span>
                <strong>{selected.description}</strong>
              </div>
              <div>
                <span>Due</span>
                <strong>{selected.dueDate}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{statusMeta[selected.status].label}</strong>
              </div>
            </div>
            {selected.status === "paid" ? (
              <div className="paid-banner">
                <Check size={18} /> Payment confirmed on Celo
              </div>
            ) : (
              <button className="primary-button" onClick={() => copyPaymentLink(selected)}>
                <Copy size={17} /> Copy verified payment link
              </button>
            )}
            <a
              className="text-button explorer-link"
              href={`https://celo.blockscout.com/address/${process.env.NEXT_PUBLIC_INVOICE_REGISTRY_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
            >
              View registry
            </a>
          </section>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
