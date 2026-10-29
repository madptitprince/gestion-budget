"""Optional real PostgreSQL + TLS integration. No remote credentials or personal DB.
Run in a venv with requirements.txt installed; needs PostgreSQL 17 and openssl.
Set PG_BIN to the directory containing initdb, pg_ctl and postgres.
"""
import http.cookiejar
import json
import os
from pathlib import Path
import socket
import ssl
import hashlib
import base64
import subprocess
import sys
import tempfile
import threading
import urllib.request
import urllib.error
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import psycopg
import server
from api.index import handler
from importer import parse_workbook
from test_app import workbook

PG_BIN = Path(os.environ.get('PG_BIN', '/usr/lib/postgresql/17/bin'))
def pg_command(name, args, pgdata):
    subprocess.run([str(PG_BIN/name), '-D', str(pgdata), *args], check=True, capture_output=True)

with tempfile.TemporaryDirectory(prefix='clair-pg-') as directory:
    root = Path(directory); pgdata = root/'db'; pgdata.mkdir()
    cert = root/'server.crt'; key = root/'server.key'
    subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
                    '-keyout', str(key), '-out', str(cert), '-subj', '/CN=localhost',
                    '-addext', 'subjectAltName=DNS:localhost'], check=True, capture_output=True)
    key.chmod(0o600)
    pg_command('initdb', ['--auth=trust', '--encoding=utf8', '-U', 'postgres'], pgdata=pgdata)
    with (pgdata/'postgresql.conf').open('a') as out:
        out.write(f"\nssl=on\nssl_cert_file='{cert}'\nssl_key_file='{key}'\n")
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
    try:
        pg_command('pg_ctl', ['-w', '-l', str(root/'postgres.log'), '-o', f'-p {port} -h 127.0.0.1 -k {root}', 'start'], pgdata=pgdata)
    except Exception:
        print((root/'postgres.log').read_text())
        raise
    httpd = None
    try:
        url = f'postgresql://postgres@localhost:{port}/postgres'
        settings = {'DATABASE_URL': '', 'budget_DATABASE_URL': url, 'VERCEL': '',
                    'BUDGET_PASSWORD': 'x', 'PGSSLMODE': 'verify-full'}
        with patch.dict(os.environ, settings), patch('certifi.where', return_value=str(cert)), \
             patch.object(server, '_initialized', None), patch.object(server, 'DB', root/'unused.sqlite3'):
            server.init_db()
            with server.connect() as db:
                assert db.execute('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()').fetchone()['ssl']
            assert not server.DB.exists(), 'Must never create a fallback SQLite DB'
            # Force a fresh initialization like a new serverless worker.
            server._initialized = None; server.init_db()
            payload = parse_workbook(workbook())
            assert server.import_entries(payload) == 4
            assert server.import_entries(payload) == 0
            assert len(server.state()['entries']) == 4
            httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
            threading.Thread(target=httpd.serve_forever, daemon=True).start()
            base = f'http://127.0.0.1:{httpd.server_port}'
            client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
            def request(path, method='GET', body=None):
                req = urllib.request.Request(base+path, method=method, headers={'Content-Type':'application/json'},
                                             data=json.dumps(body).encode() if body is not None else None)
                try:
                    with client.open(req) as r: return r.status, json.load(r)
                except urllib.error.HTTPError as e: return e.code, json.load(e)
            assert request('/api/state')[0] == 401
            assert request('/api/login', 'POST', {'password':'x'})[0] == 200
            assert len(request('/api/state')[1]['entries']) == 4
            entry = {'label':'PG check','period':'2026-10','amount':12345,'kind':'variable','category':'Alimentation','note':''}
            assert request('/api/entries','POST',entry)[0] == 200
            ident = request('/api/state')[1]['entries'][0]['id']
            entry['amount'] = 23456
            assert request(f'/api/entries/{ident}', 'PUT', entry)[0] == 200
            assert request('/api/state')[1]['entries'][0]['amount'] == 23456
            assert request(f'/api/entries/{ident}', 'DELETE')[0] == 200
            budget = {'period':'2026-10','category':'Alimentation','amount':10000}
            assert request('/api/budgets','POST',budget)[0] == 200
            assert request('/api/budgets','POST',budget)[0] == 409
            assert request('/api/goals','POST',{'label':'Test goal','target':100000,'saved':1000,'deadline':''})[0] == 200
            assert request('/api/logout','POST',{})[0] == 200
            assert request('/api/state')[0] == 401
            httpd.shutdown(); httpd.server_close(); httpd = None
            if os.environ.get('BUDGET_TEST_BROWSER'):
                from playwright.sync_api import sync_playwright, expect
                # Trust only this generated test certificate in Chromium, not arbitrary TLS errors.
                pubkey = subprocess.run(['openssl', 'x509', '-in', str(cert), '-pubkey', '-noout'],
                                        capture_output=True, check=True).stdout
                der = subprocess.run(['openssl', 'pkey', '-pubin', '-outform', 'DER'],
                                     input=pubkey, capture_output=True, check=True).stdout
                spki = base64.b64encode(hashlib.sha256(der).digest()).decode()
                httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
                tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
                tls.load_cert_chain(cert, key)
                httpd.socket = tls.wrap_socket(httpd.socket, server_side=True)
                threading.Thread(target=httpd.serve_forever, daemon=True).start()
                secure_base = f'https://localhost:{httpd.server_port}'
                with patch.dict(os.environ, {'VERCEL': '1', 'NODE_EXTRA_CA_CERTS': str(cert)}), sync_playwright() as browser_tool:
                    browser = browser_tool.chromium.launch(executable_path='/usr/bin/chromium',
                        headless=True, args=['--no-sandbox', '--ignore-certificate-errors-spki-list='+spki])
                    context = browser.new_context()
                    page = context.new_page()
                    page.goto(secure_base)
                    page.get_by_label('Votre mot de passe').fill('wrong')
                    page.locator('#login-form button').click()
                    expect(page.locator('#login-error')).to_contain_text('incorrect')
                    page.get_by_label('Votre mot de passe').fill('x')
                    page.locator('#login-form button').click()
                    expect(page.locator('.stat-card')).to_have_count(4)
                    saved = next(c for c in context.cookies() if c['name']=='clair_session')
                    assert saved['secure'] and saved['httpOnly'] and saved['sameSite']=='Lax'
                    assert page.evaluate('sessionStorage.getItem("clair_login_pending")') is None
                    page.reload(); expect(page.locator('.stat-card')).to_have_count(4)
                    # Returning from an external page must preserve a valid session.
                    page.route('https://external.example/**', lambda r: r.fulfill(
                        content_type='text/html', body=f'<a href="{secure_base}">Retour au budget</a>'))
                    page.goto('https://external.example/')
                    page.get_by_role('link', name='Retour au budget').click()
                    expect(page.locator('.stat-card')).to_have_count(4)
                    page.get_by_role('button', name='Se déconnecter').click()
                    expect(page.locator('#login-form')).to_be_visible()
                    context.close()
                    # Reproduce a browser/gateway that drops the login Set-Cookie header.
                    context = browser.new_context(); page = context.new_page()
                    def drop_cookie(route):
                        response = route.fetch()
                        headers = {k:v for k,v in response.headers.items() if k.lower()!='set-cookie'}
                        context.clear_cookies()
                        route.fulfill(response=response, headers=headers)
                    page.route('**/api/login', drop_cookie)
                    page.goto(secure_base)
                    page.get_by_label('Votre mot de passe').fill('x')
                    page.locator('#login-form button').click()
                    expect(page.locator('#login-error')).to_contain_text('connexion n’a pas été conservée')
                    expect(page.locator('#login-form button')).to_be_enabled()
                    expect(page.locator('#login-form')).to_be_visible()
                    assert page.url == secure_base+'/'
                    context.close()
                    # Session cookie present but unavailable in backend must be explicit too.
                    context = browser.new_context(); page = context.new_page()
                    page.route('**/api/session', lambda r: r.fulfill(json={
                        'enabled':True, 'authenticated':False, 'reason':'session_invalid'}))
                    page.goto(secure_base)
                    page.get_by_label('Votre mot de passe').fill('x')
                    page.locator('#login-form button').click()
                    expect(page.locator('#login-error')).to_contain_text('SESSION_INVALID')
                    expect(page.locator('#login-form')).to_be_visible()
                    context.close(); browser.close()
                httpd.shutdown(); httpd.server_close(); httpd = None
                print('PASS: HTTPS browser login, secure cookie, reload, external navigation, logout, explicit missing/invalid-session errors.')
            # Verification must fail for the wrong certificate hostname.
            with patch.dict(os.environ, {'budget_DATABASE_URL': url.replace('localhost','127.0.0.1')}):
                try:
                    with server.connect(): pass
                except psycopg.OperationalError as exc:
                    assert 'certificate' in str(exc).lower()
                else: raise AssertionError('Hostname verification was not enforced')
            with patch('certifi.where', return_value=str(root/'missing-ca.pem')):
                try:
                    with server.connect(): pass
                except psycopg.OperationalError as exc:
                    assert 'certificate' in str(exc).lower()
                else: raise AssertionError('Missing CA bundle was not rejected')
        print('PASS: real PostgreSQL, verified TLS, schema/cold start, Excel deduplication, authenticated CRUD, budgets/goals, logout, TLS failures rejected.')
    finally:
        if httpd: httpd.shutdown(); httpd.server_close()
        pg_command('pg_ctl', ['-w', 'stop', '-m', 'fast'], pgdata=pgdata)
