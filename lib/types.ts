export type StablecoinSymbol = "USDC" | "USDT" | "USDm";
export type InvoiceStatus = "pending" | "paid" | "overdue" | "cancelled";

export type InvoiceDraft = {
  client: string;
  description: string;
  amount: number;
  currency: StablecoinSymbol;
  dueDate: string;
};

export type InvoiceMetadata = {
  externalId: string;
  client: string;
  description: string;
  currency: StablecoinSymbol;
};

export type Invoice = InvoiceDraft & {
  key: `0x${string}`;
  id: string;
  issuer: `0x${string}`;
  recipient: `0x${string}`;
  token: `0x${string}`;
  amountRaw: bigint;
  createdAt: number;
  dueAt: number;
  lastReminderAt: number;
  paymentTxReference: `0x${string}`;
  status: InvoiceStatus;
};

export type UserAgent = {
  address: `0x${string}`;
  name: string;
  operator: `0x${string}`;
  reminderDelay: number;
  automationEnabled: boolean;
};

export type JobStatus =
  | "posted"
  | "funded"
  | "accepted"
  | "submitted"
  | "disputed"
  | "completed"
  | "cancelled"
  | "refunded";

export type JobVerification = "requester" | "invoice";

export type JobMetadata = {
  title: string;
  description: string;
  category: string;
  currency: StablecoinSymbol;
  invoiceKey?: `0x${string}`;
};

export type PayflowJob = {
  id: number;
  requester: `0x${string}`;
  requesterAgent: `0x${string}`;
  worker: `0x${string}`;
  workerAgent: `0x${string}`;
  token: `0x${string}`;
  verifier: `0x${string}`;
  resolver: `0x${string}`;
  rewardRaw: bigint;
  reward: number;
  acceptanceDeadline: number;
  workDeadline: number;
  reviewPeriod: number;
  submittedAt: number;
  verification: JobVerification;
  status: JobStatus;
  specificationHash: `0x${string}`;
  deliverableHash: `0x${string}`;
  metadataURI: string;
  deliverableURI: string;
  metadata: JobMetadata;
};
