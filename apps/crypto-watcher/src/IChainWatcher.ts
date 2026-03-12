export interface TransactionEvent {
  txHash: string;
  toAddress: string;
  fromAddress: string;
  /** Amount as string to preserve precision (wei for ETH, satoshi for BTC) */
  amount: string;
  /** Number of block confirmations */
  confirmations: number;
  blockNumber: number;
  timestamp: number;
}

export type TransactionCallback = (tx: TransactionEvent) => Promise<void>;

export interface IChainWatcher {
  /** Start watching an address; invoke callback for each incoming tx */
  watchAddress(address: string, callback: TransactionCallback): void;
  /** Stop watching an address */
  unwatchAddress(address: string): void;
  /** Get the latest block number */
  getCurrentBlock(): Promise<number>;
}
