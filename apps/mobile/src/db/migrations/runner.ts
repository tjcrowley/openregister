import { getDb } from '../client';

interface Migration {
  version: number;
  sql: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        pin_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'CASHIER',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        category_id TEXT,
        image_url TEXT,
        base_price INTEGER NOT NULL DEFAULT 0,
        tax_rule_id TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_products_merchant ON products(merchant_id);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(merchant_id, category_id);

      CREATE TABLE IF NOT EXISTS product_variants (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        merchant_id TEXT NOT NULL,
        sku TEXT NOT NULL,
        name TEXT NOT NULL,
        price INTEGER NOT NULL DEFAULT 0,
        cost INTEGER,
        barcode TEXT,
        track_inventory INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );

      CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
      CREATE INDEX IF NOT EXISTS idx_variants_merchant ON product_variants(merchant_id);

      CREATE TABLE IF NOT EXISTS inventory_items (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL,
        variant_id TEXT NOT NULL,
        location_id TEXT NOT NULL,
        quantity_on_hand INTEGER NOT NULL DEFAULT 0,
        reorder_point INTEGER,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(variant_id, location_id),
        FOREIGN KEY (variant_id) REFERENCES product_variants(id)
      );

      CREATE TABLE IF NOT EXISTS register_sessions (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL,
        location_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN',
        opening_cash_cents INTEGER NOT NULL DEFAULT 0,
        closing_cash_cents INTEGER,
        counted_cash_cents INTEGER,
        variance_cents INTEGER,
        opened_at INTEGER NOT NULL DEFAULT (unixepoch()),
        closed_at INTEGER,
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_merchant ON register_sessions(merchant_id, status);

      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL,
        location_id TEXT NOT NULL,
        register_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        sale_number TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        subtotal_cents INTEGER NOT NULL DEFAULT 0,
        tax_cents INTEGER NOT NULL DEFAULT 0,
        discount_cents INTEGER NOT NULL DEFAULT 0,
        total_cents INTEGER NOT NULL DEFAULT 0,
        customer_id TEXT,
        notes TEXT,
        completed_at INTEGER,
        voided_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (session_id) REFERENCES register_sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_sales_merchant ON sales(merchant_id, status);
      CREATE INDEX IF NOT EXISTS idx_sales_session ON sales(session_id);

      CREATE TABLE IF NOT EXISTS sale_lines (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL,
        variant_id TEXT NOT NULL,
        qty INTEGER NOT NULL,
        unit_cents INTEGER NOT NULL,
        tax_cents INTEGER NOT NULL DEFAULT 0,
        discount_cents INTEGER NOT NULL DEFAULT 0,
        line_total_cents INTEGER NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id),
        FOREIGN KEY (variant_id) REFERENCES product_variants(id)
      );

      CREATE INDEX IF NOT EXISTS idx_sale_lines_sale ON sale_lines(sale_id);

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL,
        merchant_id TEXT NOT NULL,
        method TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        stripe_payment_intent_id TEXT,
        stripe_charge_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        captured_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (sale_id) REFERENCES sales(id)
      );

      CREATE TABLE IF NOT EXISTS crypto_invoices (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL,
        merchant_id TEXT NOT NULL,
        address TEXT NOT NULL,
        amount_crypto TEXT NOT NULL,
        currency TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'GENERATING',
        paid_amount_crypto TEXT,
        tx_hash TEXT,
        confirmed_at INTEGER,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (sale_id) REFERENCES sales(id)
      );

      CREATE TABLE IF NOT EXISTS event_log (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        occurred_at INTEGER NOT NULL DEFAULT (unixepoch()),
        synced_at INTEGER,
        is_acknowledged INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_event_log_pending ON event_log(is_acknowledged, occurred_at);

      CREATE TABLE IF NOT EXISTS sync_cursors (
        domain TEXT PRIMARY KEY,
        cursor INTEGER NOT NULL DEFAULT 0,
        last_synced_at INTEGER
      );

      INSERT OR IGNORE INTO sync_cursors(domain, cursor) VALUES
        ('products', 0),
        ('inventory', 0),
        ('register_sessions', 0),
        ('sales', 0),
        ('settings', 0);

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `,
  },
];

export async function runMigrations(): Promise<void> {
  const database = getDb();

  // Create migrations table if it doesn't exist
  await database.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  const result = await database.execute('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1');
  const currentVersion = (result.rows?.[0] as any)?.version ?? 0;

  const pending = migrations.filter((m) => m.version > currentVersion);

  for (const migration of pending) {
    await database.execute('BEGIN');
    try {
      // Execute migration SQL (split on semicolons for multi-statement)
      const statements = migration.sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const stmt of statements) {
        await database.execute(stmt);
      }

      await database.execute(
        'INSERT INTO schema_migrations(version) VALUES (?)',
        [migration.version]
      );
      await database.execute('COMMIT');
      console.log(`[migrations] Applied migration v${migration.version}`);
    } catch (err) {
      await database.execute('ROLLBACK');
      throw new Error(`Migration v${migration.version} failed: ${err}`);
    }
  }
}
