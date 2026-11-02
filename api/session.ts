import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthenticated, isAuthEnabled, extractSessionToken } from './auth-util.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const enabled = isAuthEnabled();
    const authenticated = await isAuthenticated(req.headers);
    const token = extractSessionToken(req.headers);

    let reason = null;
    if (!authenticated) {
      reason = token ? 'session_invalid' : 'cookie_missing';
    }

    return res.status(200).json({
      enabled,
      authenticated,
      reason,
    });
  } catch (err: any) {
    console.error('[api/session] error:', err);
    return res.status(500).json({ error: 'Erreur lors de la vérification de session.' });
  }
}

