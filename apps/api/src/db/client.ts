import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';

declare global {
  // eslint-disable-next-line no-var
  var prismaInstance: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.prismaInstance ??
  new PrismaClient({
    log: config.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: config.DATABASE_URL,
      },
    },
  });

if (config.NODE_ENV !== 'production') {
  global.prismaInstance = prisma;
}

export async function connectDB(): Promise<void> {
  await prisma.$connect();
}

export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Execute fn inside a transaction with the RLS tenant context set to merchantId.
 * All Prisma queries executed via the transaction client inside fn will be
 * subject to RLS policies scoped to that merchant.
 */
export async function withMerchantContext<T>(
  merchantId: string,
  fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // Use parameterised set_config to avoid SQL injection
    await tx.$executeRaw`SELECT set_config('app.current_merchant_id', ${merchantId}, true)`;
    return fn(tx);
  });
}
