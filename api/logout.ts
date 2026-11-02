import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearSession, formatCookie } from './auth-util';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    await clearSession(req.headers);
    res.setHeader('Set-Cookie', formatCookie('', true));
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[api/logout] error:', err);
    return res.status(500).json({ error: 'Erreur lors de la déconnexion.' });
  }
}
