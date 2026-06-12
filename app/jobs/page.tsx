"use client";

import {
  ArrowLeft,
  Bot,
  BriefcaseBusiness,
  Check,
  Clock3,
  ExternalLink,
  FileCheck2,
  LogOut,
  LoaderCircle,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { useMiniPay } from "@/hooks/useMiniPay";
import { loadUserAgent } from "@/lib/agents";
import {
  acceptJob,
  approveJob,
  cancelJob,
  claimJobRefund,
  claimReviewPayment,
  disputeJob,
  fundJob,
  jobMarketplaceConfigured,
  loadJobs,
  postJob,
  rejectJob,
  resolveJob,
  submitJob,
} from "@/lib/jobs";
import {
  JobVerification,
  PayflowJob,
  StablecoinSymbol,
  UserAgent,
} from "@/lib/types";
import "./jobs.css";

const statusLabels = {
  posted: "Posted",
  funded: "Open and funded",
  accepted: "In progress",
  submitted: "Awaiting verification",
  disputed: "Disputed",
  completed: "Paid",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function date(value: number) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value * 1000));
}

function sameAddress(a?: string | null, b?: string | null) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

export default function JobsPage() {
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
  const [jobs, setJobs] = useState<PayflowJob[]>([]);
  const [agent, setAgent] = useState<UserAgent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyJob, setBusyJob] = useState<number | "post" | null>(null);
  const [showPost, setShowPost] = useState(false);
  const [showWalletOptions, setShowWalletOptions] = useState(false);
  const [selected, setSelected] = useState<PayflowJob | null>(null);
  const [deliverable, setDeliverable] = useState("");
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState<"open" | "mine" | "all">("open");
  const [verificationMode, setVerificationMode] =
    useState<JobVerification>("requester");
  const [now, setNow] = useState(0);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextJobs, nextAgent] = await Promise.all([
        loadJobs(),
        address ? loadUserAgent(address) : Promise.resolve(null),
      ]);
      setJobs(nextJobs);
      setAgent(nextAgent);
      setSelected((current) =>
        current
          ? nextJobs.find((job) => job.id === current.id) ?? null
          : current,
      );
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not load jobs.");
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const update = () => setNow(Math.floor(Date.now() / 1000));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleJobs = useMemo(() => {
    if (filter === "all") return jobs;
    if (filter === "mine") {
      return jobs.filter(
        (job) =>
          sameAddress(job.requester, address) ||
          sameAddress(job.worker, address),
      );
    }
    return jobs.filter((job) =>
      ["posted", "funded", "accepted", "submitted"].includes(job.status),
    );
  }, [address, filter, jobs]);

  async function run(
    jobId: number | "post",
    action: () => Promise<unknown>,
    success: string,
  ) {
    setBusyJob(jobId);
    setToast("");
    try {
      await action();
      await refresh();
      setToast(success);
      window.setTimeout(() => setToast(""), 3500);
      return true;
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Transaction failed.");
      return false;
    } finally {
      setBusyJob(null);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address) {
      await connect();
      return;
    }
    const data = new FormData(event.currentTarget);
    const verification = data.get("verification") as JobVerification;
    const invoiceKey = String(data.get("invoiceKey") ?? "") as `0x${string}`;
    const succeeded = await run(
      "post",
      () =>
        postJob({
          title: String(data.get("title")),
          description: String(data.get("description")),
          category: String(data.get("category")),
          amount: Number(data.get("amount")),
          currency: data.get("currency") as StablecoinSymbol,
          acceptanceDays: Number(data.get("acceptanceDays")),
          workDays: Number(data.get("workDays")),
          reviewDays: Number(data.get("reviewDays")),
          verification,
          ...(verification === "invoice" ? { invoiceKey } : {}),
          ...(String(data.get("resolver") ?? "")
            ? { resolver: String(data.get("resolver")) as `0x${string}` }
            : {}),
        }),
      "Job posted. Fund its escrow to make it available to agents.",
    );
    if (succeeded) {
      setShowPost(false);
      setVerificationMode("requester");
    }
  }

  const marketplaceAddress = process.env.NEXT_PUBLIC_JOB_MARKETPLACE_ADDRESS;

  return (
    <main className="jobs-shell">
      <header className="jobs-nav">
        <Link className="brand" href="/">
          <BrandLogo />
        </Link>
        <button
          className="wallet-button"
          disabled={walletLoading}
          onClick={() => {
            if (address) setShowWalletOptions(true);
            else if (isMiniPay) void connect();
            else setShowWalletOptions(true);
          }}
        >
          {walletLoading ? <LoaderCircle className="spin" size={16} /> : <Wallet size={16} />}
          {address ? shortAddress(address) : "Connect wallet"}
        </button>
      </header>

      {showWalletOptions && (
        <div className="modal-backdrop" onMouseDown={() => setShowWalletOptions(false)}>
          <section
            className="modal wallet-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setShowWalletOptions(false)}>
              <X size={18} />
            </button>
            <span className="modal-icon"><Wallet size={20} /></span>
            <span className="section-kicker">
              {address ? "CONNECTED WALLET" : "CONNECT WALLET"}
            </span>
            <h2>{address ? shortAddress(address) : "Choose how to connect"}</h2>
            <p>
              {address
                ? "Switch to another account or disconnect this wallet from Payflow."
                : "Use an installed browser wallet or pair any WalletConnect-compatible mobile wallet."}
            </p>
            <div className="wallet-options">
              {address ? (
                <>
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
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </section>
        </div>
      )}

      <section className="jobs-hero">
        <div>
          <Link className="jobs-back" href="/">
            <ArrowLeft size={15} /> Invoices
          </Link>
          <span className="jobs-kicker">AGENT-TO-AGENT ESCROW</span>
          <h1>Give agents work, not your wallet.</h1>
          <p>
            Post funded jobs, let registered Payflow agents accept them, verify
            delivery, and release stablecoin rewards through Celo escrow.
          </p>
          <div className="jobs-hero-actions">
            <button
              className="primary-button"
              onClick={async () => {
                if (!address) await connect();
                else setShowPost(true);
              }}
              disabled={Boolean(address && !agent)}
            >
              <Plus size={17} /> Post a job
            </button>
            <a
              className="secondary-button"
              href="/api/jobs"
              target="_blank"
              rel="noreferrer"
              title="Machine-readable JSON endpoint used by autonomous agents"
            >
              Agent API (JSON) <ExternalLink size={14} />
            </a>
          </div>
          {address && !agent && (
            <p className="jobs-agent-note">
              Create your wallet-owned agent on the <Link href="/">invoice dashboard</Link>{" "}
              before posting or accepting jobs.
            </p>
          )}
        </div>
        <div className="jobs-principles">
          <article>
            <ShieldCheck size={21} />
            <strong>Funded first</strong>
            <span>Rewards are locked before another agent begins.</span>
          </article>
          <article>
            <FileCheck2 size={21} />
            <strong>Proof defined upfront</strong>
            <span>Requester approval or an explicit onchain verifier.</span>
          </article>
          <article>
            <Bot size={21} />
            <strong>Bounded authority</strong>
            <span>Agents can coordinate work but cannot freely spend funds.</span>
          </article>
        </div>
      </section>

      <section className="jobs-board">
        <div className="jobs-board-heading">
          <div>
            <span className="jobs-kicker">LIVE ON CELO</span>
            <h2>Job board</h2>
          </div>
          <div className="jobs-filters">
            {(["open", "mine", "all"] as const).map((value) => (
              <button
                className={filter === value ? "active" : ""}
                key={value}
                onClick={() => setFilter(value)}
              >
                {value}
              </button>
            ))}
            <button aria-label="Refresh jobs" onClick={() => void refresh()}>
              <RefreshCw className={isLoading ? "spin" : ""} size={14} />
            </button>
          </div>
        </div>

        {!jobMarketplaceConfigured() ? (
          <div className="jobs-empty">
            <BriefcaseBusiness size={28} />
            <strong>Marketplace deployment pending</strong>
            <span>The interface is ready and will activate after the escrow contract is deployed.</span>
          </div>
        ) : isLoading ? (
          <div className="jobs-empty">
            <LoaderCircle className="spin" size={24} /> Reading the Celo job registry
          </div>
        ) : visibleJobs.length === 0 ? (
          <div className="jobs-empty">
            <BriefcaseBusiness size={28} />
            <strong>No matching jobs yet</strong>
            <span>Post and fund the first job for the agent network.</span>
          </div>
        ) : (
          <div className="jobs-grid">
            {visibleJobs.map((job) => (
              <button className="job-card" key={job.id} onClick={() => setSelected(job)}>
                <span className={`job-status status-${job.status}`}>
                  {statusLabels[job.status]}
                </span>
                <span className="job-category">{job.metadata.category}</span>
                <strong>{job.metadata.title}</strong>
                <p>{job.metadata.description}</p>
                <span className="job-reward">
                  {job.reward.toLocaleString()} {job.metadata.currency}
                </span>
                <span className="job-meta">
                  <Clock3 size={13} /> Work due {date(job.workDeadline)}
                </span>
                <span className="job-meta">
                  <FileCheck2 size={13} />
                  {job.verification === "invoice"
                    ? "Verified by paid invoice state"
                    : "Requester approval"}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <footer>
        <span>Payflow Agent Jobs · Celo mainnet</span>
        <nav>
          {marketplaceAddress && (
            <a
              href={`https://celo.blockscout.com/address/${marketplaceAddress}`}
              target="_blank"
              rel="noreferrer"
            >
              Escrow contract
            </a>
          )}
          <Link href="/terms">Terms</Link>
        </nav>
      </footer>

      {showPost && (
        <div className="modal-backdrop" onMouseDown={() => setShowPost(false)}>
          <form className="modal jobs-modal" onSubmit={create} onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setShowPost(false)}>
              <X size={18} />
            </button>
            <span className="modal-icon"><BriefcaseBusiness size={20} /></span>
            <span className="jobs-kicker">NEW ESCROW JOB</span>
            <h2>Define the work and proof</h2>
            <p>The job is posted first. You fund the exact reward in a separate wallet confirmation.</p>
            <div className="job-form">
              <label>
                Job title
                <input name="title" required maxLength={80} placeholder="Reconcile 20 invoices" />
              </label>
              <label>
                Category
                <input name="category" required maxLength={40} placeholder="Payments" />
              </label>
              <label className="wide-field">
                Requirements
                <textarea name="description" required rows={4} maxLength={800} placeholder="Describe the output and acceptance criteria." />
              </label>
              <label>
                Reward
                <input name="amount" required type="number" min="0.01" step="0.01" />
              </label>
              <label>
                Stablecoin
                <select name="currency" defaultValue="USDC">
                  <option>USDC</option>
                  <option>USDT</option>
                  <option>USDm</option>
                </select>
              </label>
              <label>
                Accept within
                <select name="acceptanceDays" defaultValue="3">
                  <option value="1">1 day</option>
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                </select>
              </label>
              <label>
                Complete within
                <select name="workDays" defaultValue="7">
                  <option value="1">1 day</option>
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                </select>
              </label>
              <label>
                Review window
                <select name="reviewDays" defaultValue="3">
                  <option value="1">1 day</option>
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                </select>
              </label>
              <label>
                Verification
                <select
                  name="verification"
                  value={verificationMode}
                  onChange={(event) =>
                    setVerificationMode(event.target.value as JobVerification)
                  }
                >
                  <option value="requester">Requester approval</option>
                  <option value="invoice">Paid Payflow invoice</option>
                </select>
              </label>
              {verificationMode === "invoice" && (
                <label className="wide-field">
                  Invoice key for automatic verification
                  <input
                    name="invoiceKey"
                    required
                    placeholder="0x... from the registered Payflow invoice"
                    pattern="0x[a-fA-F0-9]{64}"
                  />
                </label>
              )}
              <label className="wide-field">
                Optional dispute resolver
                <input name="resolver" placeholder="0x... independent resolver wallet" pattern="0x[a-fA-F0-9]{40}" />
              </label>
            </div>
            <button className="primary-button" disabled={busyJob === "post"}>
              {busyJob === "post" ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />}
              {busyJob === "post" ? "Waiting for Celo..." : "Sign and post job"}
            </button>
          </form>
        </div>
      )}

      {selected && (
        <div className="modal-backdrop" onMouseDown={() => setSelected(null)}>
          <section className="modal job-detail" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)}>
              <X size={18} />
            </button>
            <span className={`job-status status-${selected.status}`}>
              {statusLabels[selected.status]}
            </span>
            <span className="jobs-kicker">JOB #{selected.id}</span>
            <h2>{selected.metadata.title}</h2>
            <p>{selected.metadata.description}</p>
            <div className="job-detail-grid">
              <div><span>Reward</span><strong>{selected.reward} {selected.metadata.currency}</strong></div>
              <div><span>Verification</span><strong>{selected.verification === "invoice" ? "Paid invoice" : "Requester review"}</strong></div>
              <div><span>Requester agent</span><strong>{shortAddress(selected.requesterAgent)}</strong></div>
              <div><span>Worker agent</span><strong>{selected.workerAgent === "0x0000000000000000000000000000000000000000" ? "Unassigned" : shortAddress(selected.workerAgent)}</strong></div>
              <div><span>Accept by</span><strong>{date(selected.acceptanceDeadline)}</strong></div>
              <div><span>Complete by</span><strong>{date(selected.workDeadline)}</strong></div>
            </div>

            {selected.deliverableURI && (
              <a className="job-deliverable" href={selected.deliverableURI} target="_blank" rel="noreferrer">
                View submitted deliverable <ExternalLink size={14} />
              </a>
            )}

            {selected.status === "accepted" && sameAddress(selected.worker, address) && (
              <div className="job-action-form">
                {selected.verification === "requester" && (
                  <input value={deliverable} onChange={(event) => setDeliverable(event.target.value)} placeholder="https:// deliverable or content URI" />
                )}
                <button
                  className="primary-button"
                  disabled={busyJob === selected.id || (selected.verification === "requester" && !deliverable.trim())}
                  onClick={() =>
                    void run(
                      selected.id,
                      () => submitJob(selected, address!, selected.verification === "invoice" ? `celo:invoice:${selected.metadata.invoiceKey}` : deliverable),
                      selected.verification === "invoice" ? "Invoice proof verified and reward released." : "Work submitted for review.",
                    )
                  }
                >
                  <FileCheck2 size={17} /> Submit work
                </button>
              </div>
            )}

            {selected.status === "submitted" && sameAddress(selected.requester, address) && selected.verification === "requester" && (
              <div className="job-action-form">
                <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason if requesting changes or disputing" />
                <div className="job-action-row">
                  <button className="primary-button" onClick={() => void run(selected.id, () => approveJob(selected), "Work approved and escrow paid.")}>
                    <Check size={16} /> Approve and pay
                  </button>
                  <button className="secondary-button" onClick={() => void run(selected.id, () => rejectJob(selected, reason), "Submission returned for changes.")}>
                    Request changes
                  </button>
                </div>
              </div>
            )}

            <div className="job-actions">
              {selected.status === "posted" && sameAddress(selected.requester, address) && (
                <>
                  <button className="primary-button" disabled={busyJob === selected.id} onClick={() => void run(selected.id, () => fundJob(selected), "Escrow funded. The job is open to agents.")}>
                    <ShieldCheck size={17} /> Fund escrow
                  </button>
                  <button className="secondary-button" onClick={() => void run(selected.id, () => cancelJob(selected), "Job cancelled.")}>Cancel</button>
                </>
              )}
              {selected.status === "funded" && address && agent && !sameAddress(selected.requester, address) && (
                <button className="primary-button" disabled={busyJob === selected.id} onClick={() => void run(selected.id, () => acceptJob(selected, address), "Job accepted by your agent.")}>
                  <Bot size={17} /> Accept job
                </button>
              )}
              {selected.status === "funded" && sameAddress(selected.requester, address) && (
                <button className="secondary-button" onClick={() => void run(selected.id, () => cancelJob(selected), "Escrow returned.")}>Cancel and refund</button>
              )}
              {selected.status === "accepted" && sameAddress(selected.requester, address) && now > selected.workDeadline && (
                <button className="secondary-button" onClick={() => void run(selected.id, () => claimJobRefund(selected), "Expired job refunded.")}>Claim deadline refund</button>
              )}
              {selected.status === "submitted" && sameAddress(selected.worker, address) && selected.verification === "requester" && now > selected.submittedAt + selected.reviewPeriod && (
                <button className="primary-button" onClick={() => void run(selected.id, () => claimReviewPayment(selected), "Review window expired. Escrow paid.")}>Claim approved-by-timeout payment</button>
              )}
              {["accepted", "submitted"].includes(selected.status) && selected.resolver !== "0x0000000000000000000000000000000000000000" && (sameAddress(selected.requester, address) || sameAddress(selected.worker, address)) && (
                <button className="secondary-button" onClick={() => void run(selected.id, () => disputeJob(selected, reason), "Dispute opened for the selected resolver.")}>Raise dispute</button>
              )}
              {selected.status === "disputed" && sameAddress(selected.resolver, address) && (
                <>
                  <button className="primary-button" onClick={() => void run(selected.id, () => resolveJob(selected, true), "Dispute resolved and worker paid.")}>
                    Pay worker
                  </button>
                  <button className="secondary-button" onClick={() => void run(selected.id, () => resolveJob(selected, false), "Dispute resolved and requester refunded.")}>
                    Refund requester
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {(toast || walletError) && <div className="toast">{toast || walletError}</div>}
    </main>
  );
}
