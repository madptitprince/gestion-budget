import type { VercelRequest, VercelResponse } from '@vercel/node';
import sessionHandler from './session';
import loginHandler from './login';
import logoutHandler from './logout';
import budgetHandler from './budget';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname.endsWith('/session') || pathname === '/api/session') {
    return sessionHandler(req, res);
  }
  if (pathname.endsWith('/login') || pathname === '/api/login') {
    return loginHandler(req, res);
  }
  if (pathname.endsWith('/logout') || pathname === '/api/logout') {
    return logoutHandler(req, res);
  }
  if (pathname.endsWith('/budget') || pathname === '/api/budget') {
    return budgetHandler(req, res);
  }

  return res.status(404).json({ error: 'Endpoint introuvable.' });
}
