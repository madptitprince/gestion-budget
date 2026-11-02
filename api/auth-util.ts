import crypto from 'crypto';
import type { IncomingMessage } from 'http';
import { getDb, initDb } from './db';

const SESSION_SECONDS = 86400; // 24 hours

export function getExpectedPassword(): string {
  return process.env.BUDGET_PASSWORD || '';
}

export function isAuthEnabled(): boolean {
  return Boolean(process.env.BUDGET_PASSWORD || process.env.VERCEL);
}

export function digest(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function sessionDigest(token: string): string {
  const secret = getExpectedPassword();
  return crypto.createHash('sha256').update(token + secret).digest('hex');
}

export function extractSessionToken(headers: IncomingMessage['headers']): string {
  const cookieHeader = headers.cookie || '';
  const cookies = cookieHeader.split(';');
  for (const c of cookies) {
    const [name, val] = c.trim().split('=');
    if ((name === 'madfin_session' || name === 'clair_session') && val) {
      const cleanVal = val.trim();
      if (/^[A-Za-z0-9_-]{1,100}$/.test(cleanVal)) {
        return cleanVal;
      }
    }
  }

  // Also check Bearer Authorization header
  const authHeader = headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (/^[A-Za-z0-9_-]{1,100}$/.test(token)) {
      return token;
    }
  }

  return '';
}

export async function isAuthenticated(headers: IncomingMessage['headers']): Promise<boolean> {
  if (!isAuthEnabled()) return true;

  const token = extractSessionToken(headers);
  if (!token) return false;

  const sql = getDb();
  if (!sql) {
    // If running in development without Neon database, accept valid local token
    return token.startsWith('local_') || token.length > 20;
  }

  await initDb();
  const tokenHash = sessionDigest(token);
  const now = Math.floor(Date.now() / 1000);

  const rows = await sql`
    SELECT expires FROM sessions WHERE token_hash = ${tokenHash}
  `;

  if (rows.length > 0 && Number(rows[0].expires) > now) {
    return true;
  }

  return false;
}

export async function attemptLogin(password: string): Promise<{ status: number; token?: string; error?: string }> {
  if (typeof password !== 'string' || password.length > 1024) {
    return { status: 400, error: 'Mot de passe invalide.' };
  }

  const now = Math.floor(Date.now() / 1000);
  const sql = getDb();

  // 1. Rate Limiting Check if Neon DB is available
  if (sql) {
    await initDb();
    const rows = await sql`
      INSERT INTO login_limits (id, attempts, reset_at)
      VALUES (1, 1, ${now + 900})
      ON CONFLICT(id) DO UPDATE SET
        attempts = CASE WHEN login_limits.reset_at <= ${now} THEN 1 ELSE login_limits.attempts + 1 END,
        reset_at = CASE WHEN login_limits.reset_at <= ${now} THEN ${now + 900} ELSE login_limits.reset_at END
      RETURNING attempts
    `;

    const attempts = rows.length > 0 ? Number(rows[0].attempts) : 1;
    if (attempts > 10) {
      return { status: 429, error: 'Trop de tentatives. Réessayez dans 15 minutes.' };
    }
  }

  // 2. Validate password
  const expected = getExpectedPassword();
  let isValid = false;

  if (expected) {
    const hashA = digest(password);
    const hashB = digest(expected);
    isValid = crypto.timingSafeEqual(Buffer.from(hashA), Buffer.from(hashB));
  } else if (!process.env.VERCEL) {
    // In local dev without BUDGET_PASSWORD configured, allow login
    isValid = true;
  }

  if (!isValid) {
    return { status: 401, error: 'Mot de passe incorrect.' };
  }

  // 3. Create session token
  const token = crypto.randomBytes(32).toString('base64url');

  if (sql) {
    const tokenHash = sessionDigest(token);
    const expires = now + SESSION_SECONDS;

    await sql`
      DELETE FROM sessions WHERE expires <= ${now}
    `;

    await sql`
      INSERT INTO sessions (token_hash, expires)
      VALUES (${tokenHash}, ${expires})
    `;

    await sql`
      DELETE FROM login_limits WHERE id = 1
    `;
  }

  return { status: 200, token };
}

export async function clearSession(headers: IncomingMessage['headers']): Promise<void> {
  const token = extractSessionToken(headers);
  if (!token) return;

  const sql = getDb();
  if (sql) {
    const tokenHash = sessionDigest(token);
    await sql`
      DELETE FROM sessions WHERE token_hash = ${tokenHash}
    `;
  }
}

export function formatCookie(token: string, clear = false): string {
  const isVercel = Boolean(process.env.VERCEL);
  const secure = isVercel ? '; Secure' : '';
  const maxAge = clear ? 0 : SESSION_SECONDS;
  return `madfin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
