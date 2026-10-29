import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import MagicMock, patch
import auth
import server
import storage

class NeonConfigTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {
            'DATABASE_URL': '', 'budget_DATABASE_URL': '',
            'VERCEL': '1', 'BUDGET_PASSWORD': 'Test-only-config-password-42'
        })
        self.env.start()
    def tearDown(self): self.env.stop()
    def test_prefixed_neon_variable_passes_hosted_config_check(self):
        with patch.dict(os.environ, {'budget_DATABASE_URL': 'postgresql://test.invalid/clair'}):
            self.assertIsNone(auth.configuration_error())
            self.assertEqual(storage.database_url(), 'postgresql://test.invalid/clair')
    def test_explicit_database_url_takes_priority(self):
        with patch.dict(os.environ, {'DATABASE_URL': 'postgresql://explicit.invalid/db',
                                    'budget_DATABASE_URL': 'postgresql://prefixed.invalid/db'}):
            self.assertEqual(storage.database_url(), 'postgresql://explicit.invalid/db')
    def test_no_url_still_fails_closed(self):
        self.assertIsNone(storage.database_url() or None)
        self.assertIn('Stockage permanent', auth.configuration_error())
    def test_prefix_uses_postgres_schema_without_local_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'must-not-be-created'/'budget.sqlite3'
            connection = MagicMock()
            with patch.dict(os.environ, {'budget_DATABASE_URL': 'postgresql://test.invalid/db'}), \
                 patch.object(server, 'DB', path), patch.object(server, '_initialized', None), \
                 patch.object(server, 'connect', return_value=connection):
                server.init_db()
                db = connection.__enter__.return_value
                db.execute.assert_called_once_with('SELECT pg_advisory_xact_lock(79286042)')
                self.assertIn('BIGSERIAL PRIMARY KEY', db.executescript.call_args.args[0])
                self.assertFalse(path.parent.exists())
    def test_prefixed_url_reaches_driver_with_tls_verification(self):
        driver = types.ModuleType('psycopg'); driver.connect = MagicMock()
        rows = types.ModuleType('psycopg.rows'); rows.dict_row = object()
        with patch.dict(os.environ, {'budget_DATABASE_URL': 'postgresql://test.invalid/db'}), \
             patch.dict(sys.modules, {'psycopg': driver, 'psycopg.rows': rows}), \
             patch.object(storage.sqlite3, 'connect', side_effect=AssertionError('SQLite forbidden')):
            with storage.connection(Path('/unused')) as db:
                self.assertIsInstance(db, storage.PostgresConnection)
            driver.connect.assert_called_once_with('postgresql://test.invalid/db', row_factory=rows.dict_row,
                                                   connect_timeout=10, sslmode='verify-full', sslrootcert='system')

if __name__ == '__main__': unittest.main(verbosity=2)
