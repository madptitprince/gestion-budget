import http.cookiejar
import json
import os
from pathlib import Path
import tempfile
import threading
import time
import unittest
import urllib.request
import urllib.error
from unittest.mock import patch
import server
from api.index import handler

class AuthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base_env=patch.dict(os.environ,{"DATABASE_URL":"", "budget_DATABASE_URL":"", "VERCEL":"", "BUDGET_PASSWORD":""});cls.base_env.start()
        cls.temp=tempfile.TemporaryDirectory()
        cls.original_db=server.DB
        server.DB=Path(cls.temp.name)/'auth.sqlite3';server.init_db()
        cls.http=server.ThreadingHTTPServer(('127.0.0.1',0),handler)
        threading.Thread(target=cls.http.serve_forever,daemon=True).start()
        cls.base=f'http://127.0.0.1:{cls.http.server_port}'
    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown();cls.http.server_close();cls.temp.cleanup();server.DB=cls.original_db;cls.base_env.stop()
    def setUp(self):
        self.password='Test-only-long-passphrase-42'
        self.env=patch.dict(os.environ,{'BUDGET_PASSWORD':self.password})
        self.env.start()
        self.cookies=http.cookiejar.CookieJar()
        self.client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
        with server.connect() as db:
            db.execute('DELETE FROM sessions');db.execute('DELETE FROM login_limits')
    def tearDown(self):self.env.stop()
    def request(self,path,method='GET',body=None,client=None):
        r=urllib.request.Request(self.base+path,method=method,headers={'Content-Type':'application/json'},data=json.dumps(body).encode() if body is not None else None)
        try:
            with (client or self.client).open(r) as response:return response.status,response.read(),response.headers
        except urllib.error.HTTPError as exc:return exc.code,exc.read(),exc.headers
    def login(self):return self.request('/api/login','POST',{'password':self.password})
    def test_private_routes_require_login(self):
        for path in ['/api/state','/api/backup','/api/export','/api/index?__route=/api/state']:
            self.assertEqual(self.request(path)[0],401)
        self.assertEqual(self.request('/api/entries','POST',{})[0],401)
        self.assertEqual(self.request('/api/import/commit','POST',{})[0],401)
        status,body,_=self.request('/');self.assertEqual(status,200);self.assertIn(b'login-form',body)
    def test_login_session_and_logout(self):
        status,_,headers=self.login();self.assertEqual(status,200)
        cookie=headers['Set-Cookie'];self.assertIn('HttpOnly',cookie);self.assertIn('SameSite=Lax',cookie)
        self.assertEqual(self.request('/api/state')[0],200)
        # A new handler connection and the Vercel rewritten route share persisted sessions.
        self.assertEqual(self.request('/api/index?__route=/api/state')[0],200)
        old_cookie=cookie.split(';')[0]
        self.assertEqual(self.request('/api/logout','POST',{})[0],200)
        self.assertEqual(self.request('/api/state')[0],401)
        replay=urllib.request.build_opener();replay.addheaders=[('Cookie',old_cookie)]
        self.assertEqual(self.request('/api/state',client=replay)[0],401)
    def test_session_survives_multiple_cookie_headers_and_unrelated_bad_cookie(self):
        import http.client
        status, _, headers = self.login(); self.assertEqual(status, 200)
        session_cookie = headers['Set-Cookie'].split(';')[0]
        conn = http.client.HTTPConnection('127.0.0.1', self.http.server_port)
        try:
            conn.putrequest('GET', '/api/session')
            conn.putheader('Cookie', 'unrelated invalid cookie')
            conn.putheader('Cookie', session_cookie)
            conn.endheaders()
            response = conn.getresponse()
            self.assertEqual(response.status, 200)
            self.assertTrue(json.loads(response.read())['authenticated'])
        finally: conn.close()
    def test_session_status_distinguishes_cookie_missing_from_invalid(self):
        status, body, headers = self.request('/api/session')
        self.assertEqual(json.loads(body)['reason'], 'cookie_missing')
        client = urllib.request.build_opener(); client.addheaders = [('Cookie', 'clair_session=invalid')]
        status, body, _ = self.request('/api/session', client=client)
        self.assertEqual(json.loads(body)['reason'], 'session_invalid')
        self.assertIn('private', headers['Cache-Control'])
        self.assertEqual(headers['Vary'], 'Cookie')
    def test_conflicting_session_cookies_are_rejected(self):
        import auth
        self.assertEqual(auth.token_from_headers({'Cookie': 'clair_session=one; clair_session=two'}), '')
    def test_login_rate_limit_persists(self):
        for _ in range(10):self.assertEqual(self.request('/api/login','POST',{'password':'wrong'})[0],401)
        self.assertEqual(self.login()[0],429)
        with server.connect() as db:db.execute('UPDATE login_limits SET reset_at=0')
        self.assertEqual(self.login()[0],200)
    def test_expired_session_rejected(self):
        self.login()
        with server.connect() as db:db.execute('UPDATE sessions SET expires=?',(int(time.time())-1,))
        self.assertEqual(self.request('/api/state')[0],401)
    def test_password_rotation_invalidates_sessions(self):
        self.login()
        with patch.dict(os.environ,{'BUDGET_PASSWORD':'different-long-password-42'}):
            self.assertEqual(self.request('/api/state')[0],401)
    def test_vercel_never_falls_back_to_sqlite(self):
        with patch.dict(os.environ,{'VERCEL':'1','DATABASE_URL':''}):
            self.assertEqual(self.request('/api/state')[0],503)
    def test_missing_password_is_not_public(self):
        with patch.dict(os.environ,{'VERCEL':'1','DATABASE_URL':'postgresql://unused','BUDGET_PASSWORD':''}):
            self.assertEqual(self.request('/api/state')[0],503)
    def test_single_character_password_can_log_in(self):
        import auth
        with patch.dict(os.environ, {'BUDGET_PASSWORD': 'x'}):
            with patch.dict(os.environ, {'VERCEL': '1', 'DATABASE_URL': 'postgresql://unused'}):
                self.assertIsNone(auth.configuration_error())
            status, _, _ = self.request('/api/login', 'POST', {'password': 'x'})
            self.assertEqual(status, 200)
            self.assertEqual(self.request('/api/state')[0], 200)
            self.assertEqual(self.request('/api/logout', 'POST', {})[0], 200)
            self.assertEqual(self.request('/api/login', 'POST', {'password': 'y'})[0], 401)
    def test_secure_cookie_in_vercel(self):
        import auth
        with patch.dict(os.environ,{'VERCEL':'1'}):self.assertIn('; Secure',auth.cookie('token'))
if __name__=='__main__':unittest.main(verbosity=2)
