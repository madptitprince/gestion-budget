import io
import json
import unittest
from contextlib import redirect_stderr
from unittest.mock import patch
from storage import error_details
from server import Handler

class StorageErrorTests(unittest.TestCase):
    def test_driver_and_connection_failures_have_safe_codes(self):
        cases = [
            (ImportError('private module path'), 'DB_DRIVER'),
            (RuntimeError('root certificate file /private/path does not exist'), 'DB_TLS'),
            (RuntimeError('password authentication failed for user private-user'), 'DB_AUTH'),
            (RuntimeError('timeout expired for private-host'), 'DB_NETWORK'),
            (RuntimeError('invalid connection option private-value'), 'DB_URL'),
            (RuntimeError('private unknown detail'), 'DB_UNAVAILABLE'),
        ]
        for exc, code in cases:
            result = error_details(exc)
            self.assertEqual(result['code'], code)
            self.assertNotIn('private', json.dumps(result))
    def test_sqlstate_permissions(self):
        exc = RuntimeError('private schema'); exc.sqlstate = '42501'
        self.assertEqual(error_details(exc)['code'], 'DB_PERMISSIONS')
    def test_prepare_never_discloses_raw_exception_or_credentials(self):
        secret = 'postgresql://private:secret-password@private-host/private-db'
        handler = object.__new__(Handler)
        responses = []
        handler.send = lambda status, body: responses.append((status, body))
        logs = io.StringIO()
        with patch('auth.configuration_error', return_value=None), \
             patch('server.init_db', side_effect=RuntimeError('certificate verify failed '+secret)), \
             redirect_stderr(logs):
            self.assertFalse(handler.prepare())
        self.assertEqual(responses[0][0], 503)
        self.assertEqual(responses[0][1]['code'], 'DB_TLS')
        self.assertNotIn(secret, str(responses)+logs.getvalue())
        self.assertEqual(logs.getvalue().strip(), '[clair.storage] DB_TLS')

if __name__ == '__main__': unittest.main(verbosity=2)
