import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { logger } from './logger.js';

let sdk: NodeSDK | null = null;

export function initTelemetry(): void {
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter(),
      serviceName: 'openregister-api',
    });

    sdk.start();
    logger.info('OpenTelemetry initialized');
  } else {
    logger.debug('OpenTelemetry not configured (no OTEL_EXPORTER_OTLP_ENDPOINT)');
  }
}

export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    logger.info('OpenTelemetry shut down');
  }
}
