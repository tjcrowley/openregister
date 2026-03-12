/**
 * Names of the cursors tracked by the sync system. Each cursor represents the
 * highest server-assigned sequence number the client has successfully consumed
 * for that data domain.
 */
export type SyncCursorName =
  | 'products'
  | 'inventory'
  | 'register_sessions'
  | 'sales'
  | 'settings';

/**
 * Client-side record of the last-seen cursor position for each sync domain.
 * A value of 0 means the client has never synced that domain.
 */
export interface SyncCursors {
  products: number;
  inventory: number;
  register_sessions: number;
  sales: number;
  settings: number;
}

/** Response from GET /sync/status */
export interface SyncStatusResponse {
  cursors: SyncCursors;
  /** ISO-8601 UTC timestamp from the server */
  serverTime: string;
}

/**
 * An event originating on the client device. `id` is a UUIDv7 which encodes
 * the creation timestamp, enabling chronological ordering without a server
 * round-trip.
 */
export interface LocalEvent {
  /** UUIDv7 string */
  id: string;
  merchantId: string;
  deviceId: string;
  eventType: string;
  payload: unknown;
  /** ISO-8601 UTC timestamp */
  occurredAt: string;
  /** ISO-8601 UTC timestamp set once the server has acknowledged the event */
  syncedAt?: string;
}

/** Request body for POST /sync/push */
export interface PushPayload {
  events: LocalEvent[];
}

/** Response body for POST /sync/push */
export interface PushResponse {
  accepted: number;
  rejected: Array<{
    id: string;
    reason: string;
  }>;
}

/**
 * A server-side event returned during a pull. `cursor` is the server-assigned
 * monotonic sequence number used to paginate subsequent pull requests.
 */
export interface ServerEvent {
  /** Server-assigned auto-increment sequence number */
  id: number;
  /** Original client UUIDv7 */
  eventId: string;
  eventType: string;
  payload: unknown;
  /** ISO-8601 UTC timestamp */
  occurredAt: string;
  /** Monotonic cursor value assigned by the server */
  cursor: number;
}

/** Response body for GET /sync/pull */
export interface PullResponse {
  events: ServerEvent[];
  /** The cursor the client should persist and use on the next pull request */
  nextCursor: number;
  /** When true the client should immediately issue another pull request */
  hasMore: boolean;
}

/** Request body for POST /sync/ack */
export interface AckPayload {
  /** UUIDv7 event IDs being acknowledged */
  eventIds: string[];
}

/**
 * Represents the current state of the sync engine on the client.
 *
 * - `idle`    – up to date, no work in progress
 * - `syncing` – push/pull cycle in progress
 * - `error`   – last sync attempt failed; error details held separately
 * - `offline` – no network connectivity detected
 */
export type SyncState = 'idle' | 'syncing' | 'error' | 'offline';
