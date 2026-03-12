import { localEventQueue } from './localEventQueue';
import { applyServerEvent } from './eventApplicator';
import { getDb } from '../db/client';
import { useSyncStore } from '../stores/syncStore';
import type { SyncCursorName } from '@openregister/types';

const API_BASE = process.env.API_URL ?? 'http://localhost:3000';
const SYNC_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes
const CURSOR_NAMES: SyncCursorName[] = ['products', 'inventory', 'register_sessions', 'sales', 'settings'];

let _deviceToken: string | null = null;
let _intervalHandle: ReturnType<typeof setInterval> | null = null;
let _consecutiveErrors = 0;

export function setDeviceToken(token: string): void {
  _deviceToken = token;
}

function getBackoffMs(): number {
  const backoff = Math.min(1000 * Math.pow(2, _consecutiveErrors), MAX_BACKOFF_MS);
  return backoff;
}

async function getCursor(domain: SyncCursorName): Promise<number> {
  const db = getDb();
  const result = await db.execute('SELECT cursor FROM sync_cursors WHERE domain = ?', [domain]);
  return (result.rows?.[0] as any)?.cursor ?? 0;
}

async function setCursor(domain: SyncCursorName, cursor: number): Promise<void> {
  const db = getDb();
  await db.execute(
    'INSERT INTO sync_cursors(domain, cursor, last_synced_at) VALUES(?, ?, unixepoch()) ON CONFLICT(domain) DO UPDATE SET cursor = excluded.cursor, last_synced_at = unixepoch()',
    [domain, cursor]
  );
}

async function handshake(): Promise<boolean> {
  if (!_deviceToken) return false;
  const res = await fetch(`${API_BASE}/sync/status`, {
    headers: { Authorization: `Bearer ${_deviceToken}` },
  });
  return res.ok;
}

async function push(): Promise<void> {
  const pending = await localEventQueue.getPendingEvents(100);
  if (pending.length === 0) return;

  const res = await fetch(`${API_BASE}/sync/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${_deviceToken}`,
    },
    body: JSON.stringify({ events: pending }),
  });

  if (!res.ok) throw new Error(`Push failed: ${res.status}`);

  const data = (await res.json()) as { accepted: number; rejected: Array<{ id: string }> };
  const acceptedIds = pending.map((e) => e.id).filter((id) => !data.rejected.some((r) => r.id === id));
  await localEventQueue.markAcknowledged(acceptedIds);
}

async function pullDomain(domain: SyncCursorName): Promise<void> {
  const cursor = await getCursor(domain);
  let currentCursor = cursor;
  let hasMore = true;

  while (hasMore) {
    const res = await fetch(`${API_BASE}/sync/pull?cursor=${currentCursor}&domain=${domain}&limit=100`, {
      headers: { Authorization: `Bearer ${_deviceToken}` },
    });
    if (!res.ok) throw new Error(`Pull failed for ${domain}: ${res.status}`);

    const data = (await res.json()) as {
      events: any[];
      nextCursor: number;
      hasMore: boolean;
    };

    for (const event of data.events) {
      await applyServerEvent(event);
    }

    currentCursor = data.nextCursor;
    hasMore = data.hasMore;
    await setCursor(domain, currentCursor);
  }
}

async function pull(): Promise<void> {
  // Pull all 5 domains independently
  await Promise.all(CURSOR_NAMES.map((domain) => pullDomain(domain)));
}

async function ack(): Promise<void> {
  // Ack is handled inline in push() — this is a no-op step for the protocol
}

async function runSyncCycle(): Promise<void> {
  if (!_deviceToken) return;

  const syncStore = useSyncStore.getState();
  syncStore.setSyncStatus('syncing');

  try {
    // 4-step cycle: HANDSHAKE → PUSH → PULL → ACK
    const online = await handshake();
    if (!online) {
      syncStore.setSyncStatus('error');
      return;
    }

    await push();
    await pull();
    await ack();

    _consecutiveErrors = 0;
    syncStore.setSyncStatus('idle', new Date().toISOString());
    await localEventQueue.purgeOldEvents(30);
  } catch (err) {
    _consecutiveErrors++;
    console.warn('[SyncWorker] Sync cycle failed:', err);
    syncStore.setSyncStatus('error');
  }
}

export function startSyncWorker(deviceToken: string): void {
  _deviceToken = deviceToken;
  _consecutiveErrors = 0;

  if (_intervalHandle) clearInterval(_intervalHandle);

  // Run immediately then every 30s (with exponential backoff on errors)
  runSyncCycle();

  _intervalHandle = setInterval(() => {
    const delay = _consecutiveErrors > 0 ? getBackoffMs() : 0;
    if (delay > 0) {
      setTimeout(runSyncCycle, delay);
    } else {
      runSyncCycle();
    }
  }, SYNC_INTERVAL_MS);
}

export function stopSyncWorker(): void {
  if (_intervalHandle) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
}
