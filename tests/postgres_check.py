"""Optional real PostgreSQL + TLS integration. No remote credentials or personal DB.
Run in a venv with requirements.txt installed; needs PostgreSQL 17 and openssl.
Set PG_BIN to the directory containing initdb, pg_ctl and postgres.
"""
import http.cookiejar
import json
import os
from pathlib import Path
import socket
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
