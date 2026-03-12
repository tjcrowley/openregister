import { randomUUID } from "node:crypto";

/**
 * EventEnvelope wraps all domain events with routing and tracing metadata.
 * Every event emitted in the system is transported as an EventEnvelope so
 * consumers always have a consistent shape to work with regardless of the
 * specific payload type.
 */
export interface EventEnvelope<T = unknown> {
  /** UUIDv7 — time-ordered identifier enabling chronological sort by id alone */
  eventId: string;
  /** Fully-qualified event name, e.g. "inventory.adjusted" */
  eventType: string;
  /** Identifies the merchant that owns the data in this event */
  merchantId: string;
  /** Hardware device (terminal / POS) that originated the event */
  deviceId: string;
  /** ISO 8601 timestamp of when the business fact occurred */
  occurredAt: string;
  /** Monotonically increasing integer; increment when payload shape changes */
  schemaVersion: number;
  /** The domain-specific event data */
  payload: T;
}

/**
 * generateUUIDv7 produces a time-ordered UUID whose first 48 bits encode the
 * current Unix millisecond timestamp, matching the UUIDv7 draft specification.
 *
 * Layout (128 bits total):
 *   [0–47]   48-bit big-endian Unix timestamp in milliseconds
 *   [48–51]  version nibble = 0x7
 *   [52–63]  12 random bits
 *   [64–65]  variant bits = 0b10
 *   [66–127] 62 random bits
 *
 * We obtain the random bits by pulling them from crypto.randomUUID(), which
 * gives us 122 random bits in a pre-formatted UUID string. We replace the
 * timestamp and version fields in that string with our own values.
 */
export function generateUUIDv7(): string {
  const now = Date.now();

  // Encode the 48-bit timestamp as two 32-bit hex segments.
  // high32: upper 16 bits of timestamp (bits 47..32)
  // low16:  lower 32 bits of timestamp (bits 31..0) — we only need 32 bits here
  //         but we keep the naming consistent with the UUID field widths.
  const timestampHigh = Math.floor(now / 0x100000000); // bits 47..32 of ms timestamp
  const timestampLow = now >>> 0; // bits 31..0 of ms timestamp (unsigned 32-bit)

  // Format the first three UUID fields from the timestamp.
  // UUID canonical form: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  // Field widths (hex chars): 8-4-4-4-12
  //
  // time_high (8 hex) = upper 32 bits of timestamp, zero-padded
  // time_mid  (4 hex) = lower 16 bits of timestamp, zero-padded
  // time_low  (4 hex) = version nibble (7) + 12 random bits (from randomUUID)
  const timeHigh = timestampHigh.toString(16).padStart(4, "0"); // 16 bits → 4 hex chars
  const timeMid = (timestampLow >>> 16).toString(16).padStart(4, "0"); // bits 31..16
  const timeLow16 = (timestampLow & 0xffff).toString(16).padStart(4, "0"); // bits 15..0

  // Pull 122 bits of entropy from the platform CSPRNG via randomUUID and
  // extract the parts we need for the version + clock_seq + node fields.
  const rnd = randomUUID(); // "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
  // rnd[19..22] = 4 hex chars for the 12 random bits after the version nibble
  const rndMid = rnd.slice(19, 23); // 4 hex chars = 16 bits (we mask top 2 to variant)
  const rndNode = rnd.slice(24); // 12 hex chars = 48 bits

  // Build the version field: top nibble forced to 7, bottom 12 bits from rnd.
  const versionField = "7" + rnd.slice(15, 18); // 4 hex chars

  // Build the variant field: top 2 bits forced to 0b10, bottom 14 bits from rnd.
  // Mask the first hex char so bits [15:14] = 0b10 (values 8–b).
  const variantNibble = (
    (parseInt(rndMid[0], 16) & 0x3) |
    0x8
  ).toString(16);
  const variantField = variantNibble + rndMid.slice(1); // 4 hex chars

  // Assemble: time_high(8) - time_mid(4) - version+rand(4) - variant+rand(4) - node(12)
  return `${timeHigh}${timeMid}-${timeLow16}-${versionField}-${variantField}-${rndNode}`;
}

/**
 * buildEnvelope stamps a typed payload with the standard event metadata and
 * returns a fully-formed EventEnvelope ready for persistence or publication.
 */
export function buildEnvelope<T>(
  eventType: string,
  merchantId: string,
  deviceId: string,
  payload: T,
  schemaVersion = 1
): EventEnvelope<T> {
  return {
    eventId: generateUUIDv7(),
    eventType,
    merchantId,
    deviceId,
    occurredAt: new Date().toISOString(),
    schemaVersion,
    payload,
  };
}
