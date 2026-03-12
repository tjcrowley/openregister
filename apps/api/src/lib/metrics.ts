import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { createServer } from 'node:http';
import { logger } from './logger.js';

export const registry = new Registry();

collectDefaultMetrics({ register: registry, prefix: 'openregister_' });

export const httpRequestDuration = new Histogram({
  name: 'openregister_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [registry],
});

export const syncPushCounter = new Counter({
  name: 'openregister_sync_push_events_total',
  help: 'Total number of sync push events received',
  labelNames: ['merchant_id', 'event_type'],
  registers: [registry],
});

export const syncPullCounter = new Counter({
  name: 'openregister_sync_pull_events_total',
  help: 'Total number of sync pull events sent',
  labelNames: ['merchant_id'],
  registers: [registry],
});

export const activeRegisterSessions = new Gauge({
  name: 'openregister_active_register_sessions',
  help: 'Number of currently open register sessions',
  labelNames: ['merchant_id'],
  registers: [registry],
});

export const saleCompletedCounter = new Counter({
  name: 'openregister_sales_completed_total',
  help: 'Total number of completed sales',
  labelNames: ['merchant_id', 'payment_method'],
  registers: [registry],
});

export const paymentFailedCounter = new Counter({
  name: 'openregister_payments_failed_total',
  help: 'Total number of failed payment attempts',
  labelNames: ['merchant_id', 'method'],
  registers: [registry],
});

export function startMetricsServer(port: number): void {
  const server = createServer(async (req, res) => {
    if (req.url === '/metrics') {
      res.setHeader('Content-Type', registry.contentType);
      res.end(await registry.metrics());
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  server.listen(port, () => {
    logger.info({ port }, 'Metrics server started');
  });
}
