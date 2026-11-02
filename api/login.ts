import type { VercelRequest, VercelResponse } from '@vercel/node';
import { attemptLogin, formatCookie } from './auth-util';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: 'Veuillez saisir votre mot de passe.' });
    }

    const result = await attemptLogin(password);

    if (result.status !== 200) {
      return res.status(result.status).json({ error: result.error });
    }

    const cookieStr = formatCookie(result.token || '');
    res.setHeader('Set-Cookie', cookieStr);

    return res.status(200).json({
      ok: true,
      token: result.token,
    });
  } catch (err: any) {
    console.error('[api/login] error:', err);
    return res.status(500).json({ error: 'Erreur serveur lors de la connexion.' });
  }
}
