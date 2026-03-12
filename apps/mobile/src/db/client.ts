import { open, type DB } from '@op-engineering/op-sqlite';

let _db: DB | null = null;

function getEncryptionKey(): string {
  // In production, retrieve from Android Keystore / iOS Keychain
  // For now use a placeholder that apps should override via native module
  return process.env.DB_ENCRYPTION_KEY ?? 'openregister-dev-key-change-in-prod';
}

export function getDb(): DB {
  if (_db) return _db;
  _db = open({
    name: 'openregister.db',
    encryptionKey: getEncryptionKey(),
  });
  return _db;
}

export const db = new Proxy({} as DB, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

export async function withTransaction<T>(fn: (db: DB) => Promise<T>): Promise<T> {
  const database = getDb();
  await database.execute('BEGIN');
  try {
    const result = await fn(database);
    await database.execute('COMMIT');
    return result;
  } catch (err) {
    await database.execute('ROLLBACK');
    throw err;
  }
}
