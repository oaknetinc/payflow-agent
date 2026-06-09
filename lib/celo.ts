export const CELO_CHAIN_ID = 42220;
export const CELO_CHAIN_HEX = "0xa4ec";

export const stablecoins = {
  USDC: {
    address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    feeCurrency: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B",
    decimals: 6,
  },
  USDT: {
    address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    feeCurrency: "0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72",
    decimals: 6,
  },
  USDm: {
    address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    feeCurrency: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    decimals: 18,
  },
} as const;

export const erc20TransferAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const paymentRouterAbi = [
  {
    name: "payInvoice",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "bytes32" }],
    outputs: [],
  },
] as const;

export const invoiceRegistryAbi = [
  {
    name: "createInvoice",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "dueAt", type: "uint64" },
      { name: "metadata", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "invoices",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "bytes32" }],
    outputs: [
      { name: "issuer", type: "address" },
      { name: "recipient", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "createdAt", type: "uint64" },
      { name: "dueAt", type: "uint64" },
      { name: "lastReminderAt", type: "uint64" },
      { name: "paymentTxReference", type: "bytes32" },
      { name: "status", type: "uint8" },
      { name: "metadata", type: "string" },
    ],
  },
  {
    name: "markPaid",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId", type: "bytes32" },
      { name: "paymentTxReference", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "recordReminder",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "InvoiceCreated",
    type: "event",
    anonymous: false,
    inputs: [
      { name: "invoiceId", type: "bytes32", indexed: true },
      { name: "issuer", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "dueAt", type: "uint64", indexed: false },
      { name: "metadata", type: "string", indexed: false },
    ],
  },
  {
    name: "InvoicePaid",
    type: "event",
    anonymous: false,
    inputs: [
      { name: "invoiceId", type: "bytes32", indexed: true },
      { name: "paymentTxReference", type: "bytes32", indexed: false },
    ],
  },
] as const;

export const agentFactoryAbi = [
  {
    name: "createAgent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "reminderDelay", type: "uint32" },
    ],
    outputs: [{ name: "agent", type: "address" }],
  },
  {
    name: "agentOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "agent", type: "address" }],
  },
] as const;

export const payflowAgentAbi = [
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "operator",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "reminderDelay",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint32" }],
  },
  {
    name: "automationEnabled",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "update",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "operator", type: "address" },
      { name: "reminderDelay", type: "uint32" },
      { name: "automationEnabled", type: "bool" },
    ],
    outputs: [],
  },
] as const;

export function getStablecoinByAddress(address: string) {
  return Object.entries(stablecoins).find(
    ([, token]) => token.address.toLowerCase() === address.toLowerCase(),
  );
}
