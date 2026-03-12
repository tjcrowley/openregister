import { loadConfig } from './config.js';
import { buildApp } from './app.js';
import { connectDB, disconnectDB } from './db/client.js';
import { connectRedis, disconnectRedis } from './db/redis.js';
import { logger } from './lib/logger.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp();

  await connectDB();
  await connectRedis();

  const address = await app.listen({ port: config.PORT, host: '0.0.0.0' });
  logger.info({ address }, 'Server listening');

  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Shutting down gracefully');
    await app.close();
    await disconnectDB();
    await disconnectRedis();
    process.exit(0);
  }

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
