"""Clair — personal budget app, local or Vercel with PostgreSQL."""
import argparse
import csv
import io
import json
import os
import re
import sqlite3
import threading
import auth
from storage import connection, database_url
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from importer import parse_workbook

ROOT = Path(__file__).resolve().parent
DB = Path(os.environ.get('BUDGET_DB', ROOT / '.data/budget.sqlite3'))
KINDS = {'income', 'fixed', 'variable', 'saving'}

_init_lock = threading.Lock()
_initialized = None

def connect():
    return connection(DB)

def init_db():
    global _initialized
    url = database_url()
    postgres = bool(url)
    key = url or str(DB)
    with _init_lock:
        if _initialized == key: return
        if not postgres: DB.parent.mkdir(parents=True, exist_ok=True)
        ident = 'BIGSERIAL PRIMARY KEY' if postgres else 'INTEGER PRIMARY KEY'
        with connect() as db:
            if postgres: db.execute('SELECT pg_advisory_xact_lock(79286042)')
            db.executescript(f"""
            CREATE TABLE IF NOT EXISTS entries (
              id {ident}, label TEXT NOT NULL, period TEXT NOT NULL,
              amount BIGINT NOT NULL, kind TEXT NOT NULL, category TEXT NOT NULL,
              note TEXT NOT NULL DEFAULT '', import_key TEXT UNIQUE);
            CREATE TABLE IF NOT EXISTS budgets (
              id {ident}, period TEXT NOT NULL, category TEXT NOT NULL,
              amount BIGINT NOT NULL, UNIQUE(period, category));
            CREATE TABLE IF NOT EXISTS goals (
              id {ident}, label TEXT NOT NULL, target BIGINT NOT NULL,
              saved BIGINT NOT NULL, deadline TEXT NOT NULL DEFAULT '');
            CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires BIGINT NOT NULL);
            CREATE TABLE IF NOT EXISTS login_limits (id INTEGER PRIMARY KEY, attempts INTEGER NOT NULL, reset_at BIGINT NOT NULL);
            """)
        _initialized = key

def state():
    with connect() as db:
        return {table: [dict(r) for r in db.execute('SELECT * FROM '+table+' ORDER BY id DESC')]
                for table in ('entries', 'budgets', 'goals')}

def clean(data, table):
    def string(key, required=True, limit=180):
        value = data.get(key, '')
        if not isinstance(value, str) or len(value) > limit or (required and not value.strip()):
            raise ValueError(f'Champ {key} invalide.')
        return value.strip()
    def money(key, zero=False):
        v = data.get(key)
        if type(v) is not int or v < (0 if zero else 1) or v > 100_000_000_000:
            raise ValueError(f'Montant {key} invalide.')
        return v
    if table == 'goals':
        result = dict(label=string('label'), target=money('target'), saved=money('saved', True), deadline=string('deadline', False))
        if result['deadline'] and not re.fullmatch(r'20\d{2}-(0[1-9]|1[0-2])', result['deadline']): raise ValueError('Échéance invalide.')
        return result
    period = string('period')
    if not re.fullmatch(r'20\d{2}-(0[1-9]|1[0-2])', period): raise ValueError('Mois invalide.')
    result = dict(period=period, category=string('category'), amount=money('amount'))
    if table == 'entries':
        kind = string('kind')
        if kind not in KINDS: raise ValueError('Type invalide.')
        result.update(label=string('label'), kind=kind, note=string('note', False, 1000))
    return result

def import_entries(parsed):
    added = 0
    with connect() as db:
        for entry in parsed['entries']:
            record = clean(entry, 'entries'); record['import_key'] = entry['import_key']
            added += db.execute('INSERT INTO entries ('+','.join(record)+') VALUES ('+','.join('?' for _ in record)+') ON CONFLICT(import_key) DO NOTHING', tuple(record.values())).rowcount
    return added

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # No financial payloads in access logs.
    def send(self, status, payload, mime='application/json; charset=utf-8', download=None, cookie=None):
        data = json.dumps(payload, ensure_ascii=False).encode() if mime.startswith('application/json') else payload
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'same-origin')
        if cookie: self.send_header('Set-Cookie', cookie)
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'")
        if download: self.send_header('Content-Disposition', f'attachment; filename="{download}"')
        self.end_headers(); self.wfile.write(data)
    def prepare(self):
        error = auth.configuration_error()
        if error:
            self.send(503, {'error': error}); return False
        try:
            init_db()
        except Exception:
            self.send(503, {'error': 'Stockage indisponible. Vérifiez la connexion à la base.'}); return False
        return True
    def do_GET(self):
        try: self.get()
        except Exception: self.send(503, {'error': 'Service momentanément indisponible.'})
    def get(self):
        path = urlparse(self.path).path
        public_files = {'/styles.css': ('styles.css', 'text/css'), '/login.js': ('login.js', 'text/javascript')}
        if path in public_files:
            name, mime = public_files[path]
            return self.send(200, (ROOT/'web'/name).read_bytes(), mime+'; charset=utf-8')
        if not self.prepare(): return
        signed_in = auth.authenticated(self.headers, connect)
        if path == '/api/session': return self.send(200, {'enabled': auth.enabled(), 'authenticated': signed_in})
        if not signed_in:
            if path in ('/', '/login'):
                return self.send(200, (ROOT/'web/login.html').read_bytes(), 'text/html; charset=utf-8')
            return self.send(401, {'error': 'Connectez-vous pour accéder à votre budget.'})
        if path == '/api/state': return self.send(200, state())
        if path == '/api/backup': return self.send(200, {'version': 1, **state()}, download='clair-sauvegarde.json')
        if path == '/api/export':
            out = io.StringIO(); writer = csv.writer(out, delimiter=';')
            writer.writerow(['Mois', 'Libellé', 'Type', 'Catégorie', 'Montant EUR', 'Note'])
            types = dict(income='Revenu', fixed='Dépense fixe', variable='Dépense variable', saving='Épargne')
            for e in state()['entries']:
                def safe(v): return "'"+v if v.startswith(('=', '+', '-', '@', '\t', '\r')) else v
                writer.writerow([e['period'], safe(e['label']), types[e['kind']], safe(e['category']), f"{e['amount']/100:.2f}".replace('.', ','), safe(e['note'])])
            return self.send(200, ('\ufeff'+out.getvalue()).encode(), 'text/csv; charset=utf-8', 'clair-operations.csv')
        files = {'/':'index.html', '/app.js':'app.js', '/styles.css':'styles.css'}
        if path in files:
            mime = 'text/html' if path == '/' else 'text/javascript' if path.endswith('.js') else 'text/css'
            return self.send(200, (ROOT/'web'/files[path]).read_bytes(), mime+'; charset=utf-8')
        self.send(404, {'error':'Page introuvable.'})
    def mutate(self, method):
        try:
            # Reject cross-site writes; all authenticated mutations use non-simple content types.
            origin = self.headers.get('Origin')
            if origin and urlparse(origin).netloc != self.headers.get('Host'): return self.send(403, {'error':'Origine refusée.'})
            if self.headers.get('Sec-Fetch-Site') == 'cross-site': return self.send(403, {'error': 'Origine refusée.'})
            if not self.prepare(): return
            path = urlparse(self.path).path
            if path != '/api/login' and not auth.authenticated(self.headers, connect):
                return self.send(401, {'error': 'Connectez-vous pour accéder à votre budget.'})
            size = int(self.headers.get('Content-Length', 0))
            if size < 0 or size > 4_000_000: return self.send(413, {'error':'Fichier limité à 4 Mo.'})
            raw = self.rfile.read(size)
            path = urlparse(self.path).path
            if path in ('/api/login', '/api/logout') and method == 'POST':
                if not self.headers.get('Content-Type', '').startswith('application/json'):
                    return self.send(415, {'error': 'JSON requis.'})
                if path == '/api/logout':
                    auth.logout(self.headers, connect)
                    return self.send(200, {'ok': True}, cookie=auth.cookie(clear=True))
                if not auth.enabled(): return self.send(400, {'error': 'Connexion non activée en local.'})
                status, token = auth.login(json.loads(raw).get('password'), connect)
                if status == 200: return self.send(200, {'ok': True}, cookie=auth.cookie(token))
                return self.send(status, {'error': 'Trop de tentatives. Réessayez dans 15 minutes.' if status == 429 else 'Mot de passe incorrect.'})
            if path in ('/api/import/preview', '/api/import/commit') and method == 'POST':
                parsed = parse_workbook(raw)
                if path.endswith('preview'):
                    with connect() as db: keys = {r['import_key'] for r in db.execute('SELECT import_key FROM entries WHERE import_key IS NOT NULL')}
                    parsed['duplicates'] = sum(e['import_key'] in keys for e in parsed['entries'])
                    return self.send(200, parsed)
                return self.send(200, {'added':import_entries(parsed)})
            if method != 'DELETE' and not self.headers.get('Content-Type', '').startswith('application/json'):
                return self.send(415, {'error':'JSON requis.'})
            match = re.fullmatch(r'/api/(entries|budgets|goals)(?:/(\d+))?', path)
            if not match: return self.send(404, {'error':'Route introuvable.'})
            table, ident = match.groups()
            with connect() as db:
                if method == 'DELETE' and ident:
                    if not db.execute('DELETE FROM '+table+' WHERE id=?', (ident,)).rowcount: return self.send(404, {'error':'Élément introuvable.'})
                elif method in ('POST','PUT'):
                    values = clean(json.loads(raw), table)
                    if method == 'PUT' and ident:
                        if not db.execute('UPDATE '+table+' SET '+','.join(k+'=?' for k in values)+' WHERE id=?', (*values.values(), ident)).rowcount: return self.send(404, {'error':'Élément introuvable.'})
                    elif method == 'POST' and not ident:
                        db.execute('INSERT INTO '+table+' ('+','.join(values)+') VALUES ('+','.join('?' for _ in values)+')', tuple(values.values()))
                    else: return self.send(400, {'error':'Identifiant requis.'})
                else: return self.send(400, {'error':'Requête invalide.'})
            self.send(200, {'ok':True})
        except sqlite3.IntegrityError:
            self.send(409, {'error':'Un budget existe déjà pour cette catégorie et ce mois.'})
        except (ValueError, KeyError, zipfile.BadZipFile, ET.ParseError) as e:
            self.send(400, {'error':str(e) if isinstance(e, ValueError) else 'Fichier ou données invalides.'})
        except Exception:
            self.send(500, {'error':'Impossible de terminer cette opération.'})
    def do_POST(self): self.mutate('POST')
    def do_PUT(self): self.mutate('PUT')
    def do_DELETE(self): self.mutate('DELETE')

# Needed by the importer error handler, without external dependencies.
import zipfile
import xml.etree.ElementTree as ET
if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=3000)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--import-xlsx', type=Path)
    args = parser.parse_args(); init_db()
    if args.import_xlsx:
        count = import_entries(parse_workbook(args.import_xlsx.read_bytes()))
        print(f'{count} lignes importées.', flush=True)
    http = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f'Clair démarré sur le port {args.port}.', flush=True)
    http.serve_forever()
