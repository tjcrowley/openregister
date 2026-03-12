import Redis from 'ioredis';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
    });

    redisInstance.on('connect', () => logger.info('Redis connected'));
    redisInstance.on('error', (err) => logger.error({ err }, 'Redis error'));
    redisInstance.on('close', () => logger.warn('Redis connection closed'));
    redisInstance.on('reconnecting', () => logger.info('Redis reconnecting'));
  }
  return redisInstance;
}

export const redis = getRedis();

export async function disconnectRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
  }
}
