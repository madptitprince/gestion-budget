import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Local Dev Auth & Sync Mock Plugin
function devAuthPlugin(): Plugin {
  let devAuthenticated = false;

  return {
    name: 'dev-auth-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];

        if (url === '/api/session') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            enabled: true,
            authenticated: devAuthenticated,
            reason: devAuthenticated ? null : 'not_authenticated'
          }));
          return;
        }

        if (url === '/api/login' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { password } = JSON.parse(body || '{}');
              if (password) {
                devAuthenticated = true;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Set-Cookie', 'madfin_session=local_dev_token; Path=/; HttpOnly; SameSite=Lax');
                res.end(JSON.stringify({ ok: true, token: 'local_dev_token' }));
              } else {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Mot de passe requis.' }));
              }
            } catch (_) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'JSON invalide' }));
            }
          });
          return;
        }

        if (url === '/api/logout' && req.method === 'POST') {
          devAuthenticated = false;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Set-Cookie', 'madfin_session=; Path=/; Max-Age=0');
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        if (url === '/api/budget') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ data: null, source: 'local_dev' }));
          return;
        }

        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devAuthPlugin()],
  server: {
    port: 5173,
    host: true
  }
});
