import { EthereumWatcher } from './EthereumWatcher.js';
import { InvoicePoller } from './InvoicePoller.js';

const ETH_RPC_URL = process.env.ETH_RPC_URL ?? 'https://mainnet.infura.io/v3/your-infura-key';

async function main(): Promise<void> {
  console.log('[crypto-watcher] Starting…');

  const ethWatcher = new EthereumWatcher(ETH_RPC_URL);
  const invoicePoller = new InvoicePoller(ethWatcher);

  invoicePoller.start();
  console.log('[crypto-watcher] Invoice poller started');

  const block = await ethWatcher.getCurrentBlock().catch(() => 0);
  console.log(`[crypto-watcher] Current ETH block: ${block}`);

  process.on('SIGTERM', () => {
    console.log('[crypto-watcher] Shutting down');
    invoicePoller.stop();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('[crypto-watcher] Shutting down');
    invoicePoller.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[crypto-watcher] Fatal error:', err);
  process.exit(1);
});
