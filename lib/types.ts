export type StablecoinSymbol = "USDC" | "USDT" | "USDm";
export type InvoiceStatus = "pending" | "paid" | "overdue";

export type InvoiceDraft = {
  client: string;
  email: string;
  description: string;
  amount: number;
  currency: StablecoinSymbol;
  dueDate: string;
};

export type Invoice = InvoiceDraft & {
  id: string;
  status: InvoiceStatus;
};
