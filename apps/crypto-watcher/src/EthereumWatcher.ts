import { ethers } from 'ethers';
import type { IChainWatcher, TransactionCallback } from './IChainWatcher.js';

interface WatchEntry {
  address: string;
  callback: TransactionCallback;
}

export class EthereumWatcher implements IChainWatcher {
  private provider: ethers.JsonRpcProvider;
  private watchers = new Map<string, WatchEntry>();
  private lastBlock = 0;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(rpcUrl: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  watchAddress(address: string, callback: TransactionCallback): void {
    const normalized = address.toLowerCase();
    this.watchers.set(normalized, { address: normalized, callback });
    if (!this.pollInterval) {
      this.startPolling();
    }
  }

  unwatchAddress(address: string): void {
    this.watchers.delete(address.toLowerCase());
    if (this.watchers.size === 0 && this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async getCurrentBlock(): Promise<number> {
    return this.provider.getBlockNumber();
  }

  private startPolling(): void {
    this.pollInterval = setInterval(() => this.pollNewBlocks(), 12_000); // ~ETH block time
    // Initialize last block
    this.provider.getBlockNumber().then((n) => { this.lastBlock = n - 1; }).catch(() => {});
  }

  private async pollNewBlocks(): Promise<void> {
    try {
      const latestBlock = await this.provider.getBlockNumber();
      if (latestBlock <= this.lastBlock) return;

      for (let blockNum = this.lastBlock + 1; blockNum <= latestBlock; blockNum++) {
        await this.processBlock(blockNum);
      }
      this.lastBlock = latestBlock;
    } catch (err) {
      console.error('[EthereumWatcher] Poll error:', err);
    }
  }

  private async processBlock(blockNum: number): Promise<void> {
    const block = await this.provider.getBlock(blockNum, true);
    if (!block) return;

    for (const tx of block.prefetchedTransactions) {
      if (!tx.to) continue;
      const toNorm = tx.to.toLowerCase();
      const entry = this.watchers.get(toNorm);
      if (!entry) continue;

      const receipt = await this.provider.getTransactionReceipt(tx.hash);
      const confirmations = receipt ? await receipt.confirmations() : 0;

      await entry.callback({
        txHash: tx.hash,
        toAddress: tx.to,
        fromAddress: tx.from,
        amount: tx.value.toString(),
        confirmations,
        blockNumber: blockNum,
        timestamp: block.timestamp,
      });
    }
  }
}
