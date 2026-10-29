"""Single-owner login. Opaque sessions and rate limits live in the database."""
import hashlib
import hmac
from http.cookies import SimpleCookie, CookieError
import os
import secrets
import re
import time
from storage import database_url

SESSION_SECONDS = 86400

def enabled(): return bool(os.environ.get('BUDGET_PASSWORD') or os.environ.get('VERCEL'))

def configuration_error():
    password = os.environ.get('BUDGET_PASSWORD', '')
    if os.environ.get('VERCEL') and not database_url():
        return 'Stockage permanent non configuré. Ajoutez DATABASE_URL ou budget_DATABASE_URL dans Vercel.'
    if enabled() and not password:
        return 'Accès privé non configuré. Définissez BUDGET_PASSWORD avec un mot de passe non vide.'
    return None

def token_from_headers(headers):
    # HTTP/2 gateways may forward Cookie as multiple header fields. Read all of
    # them, and do not let an unrelated malformed cookie hide our session.
    values = (headers.get_all('Cookie', []) if hasattr(headers, 'get_all')
              else [headers.get('Cookie') or headers.get('cookie', '')])
    tokens = set()
    for value in values:
        for part in value.split(';'):
            name, separator, raw = part.strip().partition('=')
            if name != 'clair_session' or not separator:
                continue
            try:
                cookie = SimpleCookie(); cookie.load(name + '=' + raw)
                token = cookie[name].value if name in cookie else ''
            except CookieError:
                continue
            if re.fullmatch(r'[A-Za-z0-9_-]{1,100}', token):
                tokens.add(token)
    # Conflicting session cookies are ambiguous; never silently pick an identity.
    return next(iter(tokens)) if len(tokens) == 1 else ''

def digest(token): return hashlib.sha256(token.encode()).hexdigest()

def session_digest(token):
    return digest(token + os.environ.get('BUDGET_PASSWORD', ''))

def authenticated(headers, connect):
    if not enabled(): return True
    token = token_from_headers(headers)
    if not token: return False
    with connect() as db:
        row = db.execute('SELECT expires FROM sessions WHERE token_hash=?', (session_digest(token),)).fetchone()
    return bool(row and row['expires'] > int(time.time()))

def login(password, connect):
    if not isinstance(password, str) or len(password) > 1024: return 400, None
    now = int(time.time())
    with connect() as db:
        row = db.execute('''INSERT INTO login_limits (id, attempts, reset_at) VALUES (1, 1, ?)
          ON CONFLICT(id) DO UPDATE SET
          attempts=CASE WHEN login_limits.reset_at<=? THEN 1 ELSE login_limits.attempts+1 END,
          reset_at=CASE WHEN login_limits.reset_at<=? THEN ? ELSE login_limits.reset_at END
          RETURNING attempts''', (now+900, now, now, now+900)).fetchone()
        attempts = row['attempts']
    if attempts > 10: return 429, None
    expected = os.environ.get('BUDGET_PASSWORD', '')
    if not expected or not hmac.compare_digest(digest(password), digest(expected)):
        return 401, None
    token = secrets.token_urlsafe(32)
    with connect() as db:
        db.execute('DELETE FROM sessions WHERE expires<=?', (now,))
        db.execute('INSERT INTO sessions (token_hash, expires) VALUES (?, ?)', (session_digest(token), now+SESSION_SECONDS))
        db.execute('DELETE FROM login_limits WHERE id=1')
    return 200, token

def logout(headers, connect):
    token = token_from_headers(headers)
    if token:
        with connect() as db: db.execute('DELETE FROM sessions WHERE token_hash=?', (session_digest(token),))

def cookie(token='', clear=False):
    # Vercel terminates HTTPS; local HTTP tests intentionally use a non-Secure cookie.
    secure = '; Secure' if os.environ.get('VERCEL') else ''
    return f'clair_session={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={0 if clear else SESSION_SECONDS}{secure}'
