import { Worker, type Job } from 'bullmq';
import { redis } from '../db/redis.js';
import { prisma } from '../db/client.js';
import { logger } from '../lib/logger.js';

interface ReportRefreshPayload {
  merchantId?: string;
  viewName?: string;
}

async function refreshMaterializedViews(payload: ReportRefreshPayload): Promise<void> {
  const views = payload.viewName
    ? [payload.viewName]
    : ['daily_sales_summary'];

  for (const view of views) {
    try {
      await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
      logger.info({ view }, 'Materialized view refreshed');
    } catch (err) {
      logger.warn({ err, view }, 'Failed to refresh materialized view');
      throw err;
    }
  }
}

export const reportRefreshWorker = new Worker(
  'reportRefresh',
  async (job: Job<ReportRefreshPayload>) => {
    await refreshMaterializedViews(job.data);
  },
  {
    connection: redis,
    concurrency: 2,
  }
);

reportRefreshWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Report refresh job failed');
});
