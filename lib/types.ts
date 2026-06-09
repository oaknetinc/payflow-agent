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
