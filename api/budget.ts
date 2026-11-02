import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthenticated } from './auth-util.js';
import { getDb, initDb } from './db.js';
import { initialBudgetData } from './initialData.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const signedIn = await isAuthenticated(req.headers);
    if (!signedIn) {
      return res.status(401).json({ error: 'Connectez-vous pour accéder à vos données de budget.' });
    }

    const sql = getDb();
    if (!sql) {
      // Local dev mode without Neon connection
      if (req.method === 'GET') {
        return res.status(200).json({ data: initialBudgetData, source: 'local' });
      }
      return res.status(200).json({ ok: true, source: 'local' });
    }

    await initDb();

    if (req.method === 'GET') {
      const forceSeed = req.query?.seed === '1' || req.query?.force === 'true';

      const rows = await sql`
        SELECT data_json, updated_at FROM madfin_data WHERE id = 'main'
      `;

      let shouldSeed = rows.length === 0 || forceSeed;

      if (!shouldSeed && rows.length > 0) {
        try {
          const existing = JSON.parse(rows[0].data_json);
          // Check if existing data is the old empty November data (salary in nov is 0)
          const novSalary = existing?.['2026']?.income?.[0]?.values?.nov || 0;
          if (novSalary === 0) {
            shouldSeed = true;
          }
        } catch (_) {
          shouldSeed = true;
        }
      }

      if (shouldSeed) {
        const now = Math.floor(Date.now() / 1000);
        const seedStr = JSON.stringify(initialBudgetData);
        await sql`
          INSERT INTO madfin_data (id, data_json, updated_at)
          VALUES ('main', ${seedStr}, ${now})
          ON CONFLICT(id) DO UPDATE SET
            data_json = EXCLUDED.data_json,
            updated_at = EXCLUDED.updated_at
        `;
        return res.status(200).json({
          data: initialBudgetData,
          updated_at: now,
          source: 'neon_seeded',
        });
      }

      const parsed = JSON.parse(rows[0].data_json);
      return res.status(200).json({
        data: parsed,
        updated_at: Number(rows[0].updated_at),
        source: 'neon',
      });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const { data } = req.body || {};
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'Données de budget invalides.' });
      }

      const now = Math.floor(Date.now() / 1000);
      const jsonStr = JSON.stringify(data);

      await sql`
        INSERT INTO madfin_data (id, data_json, updated_at)
        VALUES ('main', ${jsonStr}, ${now})
        ON CONFLICT(id) DO UPDATE SET
          data_json = EXCLUDED.data_json,
          updated_at = EXCLUDED.updated_at
      `;

      return res.status(200).json({ ok: true, updated_at: now });
    }

    return res.status(405).json({ error: 'Méthode non autorisée.' });
  } catch (err: any) {
    console.error('[api/budget] error:', err);
    return res.status(500).json({ error: 'Erreur lors de la synchronisation avec la base de données.' });
  }
}

