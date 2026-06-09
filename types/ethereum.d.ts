interface EthereumProvider {
  isMiniPay?: boolean;
  accounts?: string[];
  chainId?: number | string;
  connected?: boolean;
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
  connect?(): Promise<unknown>;
  disconnect?(): Promise<void>;
}

interface Window {
  ethereum?: EthereumProvider;
}
