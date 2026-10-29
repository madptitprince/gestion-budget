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
        from psycopg.rows import dict_row
        # Hosted DB connections always verify the provider's certificate and hostname.
        with psycopg.connect(url, row_factory=dict_row, connect_timeout=10,
                             sslmode='verify-full', sslrootcert='system') as raw:
            yield PostgresConnection(raw)
    else:
        db = sqlite3.connect(path, timeout=15)
        db.row_factory = sqlite3.Row
        try:
            with db: yield db
        finally: db.close()
