import { neon } from '@neondatabase/serverless';

export function getDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.budget_DATABASE_URL ||
    process.env.budget_POSTGRES_URL ||
    process.env.POSTGRES_URL
  );
}

export function getDb() {
  const url = getDatabaseUrl();
  if (!url) return null;
  return neon(url);
}

let _initialized = false;

export async function initDb() {
  if (_initialized) return;
  const sql = getDb();
  if (!sql) return;

  try {
    // 1. Sessions table (compatible with existing table from gestion-budget)
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        expires BIGINT NOT NULL
      );
    `;

    // 2. Login limits table (compatible with existing table from gestion-budget)
    await sql`
      CREATE TABLE IF NOT EXISTS login_limits (
        id INTEGER PRIMARY KEY,
        attempts INTEGER NOT NULL,
        reset_at BIGINT NOT NULL
      );
    `;

    // 3. MADFIN Data table (stores full multi-year budget data in Neon)
    await sql`
      CREATE TABLE IF NOT EXISTS madfin_data (
        id TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        updated_at BIGINT NOT NULL
      );
    `;

    _initialized = true;
  } catch (err) {
    console.error('[madfin.db] initDb error:', err);
    throw err;
  }
}

