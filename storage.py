"""SQLite locally; durable PostgreSQL with standard or Neon-prefixed config."""
from contextlib import contextmanager
import os
import sqlite3

def database_url():
    """Prefer the explicit override; accept this project's Neon integration prefix."""
    return os.environ.get('DATABASE_URL') or os.environ.get('budget_DATABASE_URL')

class PostgresConnection:
    def __init__(self, raw): self.raw = raw
    def execute(self, sql, params=()):
        try:
            return self.raw.execute(sql.replace('?', '%s'), params)
        except Exception as exc:
            # Expose the same public conflict response without leaking database details.
            if getattr(exc, 'sqlstate', None) in ('23505', '23502', '23514'):
                raise sqlite3.IntegrityError('Contrainte de données.') from None
            raise
    def executescript(self, sql):
        for statement in sql.split(';'):
            if statement.strip(): self.execute(statement)

@contextmanager
def connection(path):
    url = database_url()
    if url:
        import psycopg
        import certifi
        from psycopg.rows import dict_row
        # Binary libpq wheels may embed a build-time OpenSSL trust path that does
        # not exist on Vercel. Supply a portable Mozilla bundle explicitly.
        # Certificate and hostname verification remain mandatory.
        with psycopg.connect(url, row_factory=dict_row, connect_timeout=10,
                             sslmode='verify-full', sslrootcert=certifi.where()) as raw:
            yield PostgresConnection(raw)
    else:
        db = sqlite3.connect(path, timeout=15)
        db.row_factory = sqlite3.Row
        try:
            with db: yield db
        finally: db.close()

def error_details(exc):
    """Return only fixed messages/codes; never return a DSN or raw driver exception."""
    message = str(exc).lower()
    sqlstate = getattr(exc, 'sqlstate', None)
    if isinstance(exc, ImportError):
        return {'code': 'DB_DRIVER', 'error': 'Pilote PostgreSQL indisponible. Redéployez avec les dépendances à jour.'}
    if any(term in message for term in ('certificate', 'sslrootcert', 'ssl error', 'tls error')):
        return {'code': 'DB_TLS', 'error': 'La connexion sécurisée à PostgreSQL a échoué. Vérifiez les certificats du déploiement.'}
    if sqlstate in ('28P01', '28000') or 'password authentication failed' in message:
        return {'code': 'DB_AUTH', 'error': 'Les identifiants PostgreSQL sont refusés. Reconnectez la base Neon au projet Vercel.'}
    if sqlstate == '42501':
        return {'code': 'DB_PERMISSIONS', 'error': 'Le compte PostgreSQL ne peut pas initialiser les tables. Vérifiez ses droits sur la base.'}
    if sqlstate == '3D000':
        return {'code': 'DB_NAME', 'error': 'La base PostgreSQL indiquée est introuvable. Vérifiez la connexion fournie par Neon.'}
    if any(term in message for term in ('invalid connection', 'invalid dsn', 'missing "="', 'invalid uri')):
        return {'code': 'DB_URL', 'error': 'La chaîne de connexion PostgreSQL est invalide. Utilisez la valeur fournie par Neon.'}
    if any(term in message for term in ('timeout', 'timed out', 'connection refused', 'could not translate host')):
        return {'code': 'DB_NETWORK', 'error': 'PostgreSQL est injoignable. Vérifiez que la base Neon est active et accessible.'}
    return {'code': 'DB_UNAVAILABLE', 'error': 'Stockage indisponible. Vérifiez la connexion à la base.'}
