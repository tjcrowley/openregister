const logger = {
  warn: (context: string, err: unknown) => {
    console.warn(`[HW:${context}]`, err);
  },
};

/**
 * Safely invoke a hardware driver function. Never throws — always returns the
 * fallback value if the driver call fails. Logs the error with context.
 */
export async function safeHardwareCall<T>(
  fn: () => Promise<T>,
  fallback: T,
  context: string
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logger.warn(context, err);
    return fallback;
  }
}
