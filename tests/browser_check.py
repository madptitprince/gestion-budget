"""Optional end-to-end check. Needs Playwright and Chromium; uses a disposable DB."""
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import server
from api.index import handler
from importer import parse_workbook
from test_app import workbook
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
# Keep all browser checks on their disposable SQLite database, even in hosted environments.
for name in ('DATABASE_URL','budget_DATABASE_URL','VERCEL','BUDGET_PASSWORD'): os.environ.pop(name, None)
with tempfile.TemporaryDirectory() as tmp:
    server.DB=Path(tmp)/'browser.sqlite3'
    server.init_db()
    file=os.environ.get('BUDGET_TEST_XLSX')
    parsed=parse_workbook(Path(file).read_bytes() if file else workbook())
    if not file:
        for entry in parsed['entries']: entry['period']='2026-10'
    server.import_entries(parsed)
    test_auth=bool(os.environ.get('BUDGET_TEST_AUTH'))
    if test_auth: os.environ['BUDGET_PASSWORD']='browser-test-password-only-42'
    http=server.ThreadingHTTPServer(('127.0.0.1',0),handler)
    threading.Thread(target=http.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
            page=browser.new_page(viewport={'width':1440,'height':1000})
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(f'http://127.0.0.1:{http.server_port}')
            if test_auth:
                expect(page.locator('#login-form')).to_be_visible()
                page.get_by_label('Votre mot de passe').fill(os.environ['BUDGET_PASSWORD'])
                page.get_by_role('button',name='Accéder à mon budget',exact=False).click()
            expect(page.locator('.stat-card')).to_have_count(4)
            page.locator('#period').fill('2026-10');page.locator('#period').dispatch_event('change')
            before=len(server.state()['entries'])
            page.get_by_role('button',name='Ajouter une opération',exact=True).first.click()
            page.get_by_label('Libellé',exact=True).fill('Test navigateur courses')
            page.get_by_label('Montant (€)',exact=True).fill('12.34')
            page.get_by_role('button',name='Ajouter l’opération',exact=True).click()
            expect(page.locator('#modal')).not_to_be_visible()
            assert len(server.state()['entries'])==before+1
            page.locator('.nav-item[data-page="entries"]').click()
            page.get_by_label('Rechercher une opération').fill('Test navigateur courses')
            expect(page.locator('tbody tr')).to_have_count(1)
            page.get_by_role('button',name='Modifier Test navigateur courses',exact=True).click()
            page.get_by_label('Montant (€)',exact=True).fill('25.50')
            page.get_by_role('button',name='Enregistrer les modifications').click()
            expect(page.locator('#modal')).not_to_be_visible()
            expect(page.locator('tbody')).to_contain_text('25,50')
            page.reload();page.wait_for_selector('tbody')
            page.get_by_label('Rechercher une opération').fill('Test navigateur courses')
            expect(page.locator('tbody')).to_contain_text('25,50')
            page.get_by_role('button',name='Supprimer Test navigateur courses',exact=True).click()
            page.get_by_role('button',name='Supprimer',exact=True).click()
            expect(page.locator('#modal')).not_to_be_visible()
            assert len(server.state()['entries'])==before
            page.locator('.nav-item[data-page="budgets"]').click()
            page.get_by_role('button',name='Créer un budget',exact=True).first.click()
            page.get_by_label('Plafond (€)',exact=True).fill('50')
            page.get_by_role('button',name='Enregistrer le budget').click()
            expect(page.locator('#modal')).not_to_be_visible()
            expect(page.locator('.budget-bottom')).to_contain_text('dépassement')
            page.locator('.nav-item[data-page="savings"]').click()
            page.get_by_role('button',name='Nouvel objectif',exact=True).click()
            page.get_by_label('Nom du projet').fill('Voyage test')
            page.get_by_label('Objectif (€)',exact=True).fill('1000')
            page.get_by_label('Déjà réservé (€)',exact=True).fill('250')
            page.get_by_role('button',name='Enregistrer l’objectif').click()
            expect(page.locator('#modal')).not_to_be_visible()
            expect(page.locator('#content')).to_contain_text('Voyage test')
            assert server.state()['goals'][0]['saved']==25000
            page.get_by_role('button',name='Mettre à jour',exact=True).first.click()
            page.get_by_label('Déjà réservé (€)',exact=True).fill('500')
            page.get_by_role('button',name='Enregistrer l’objectif').click()
            expect(page.locator('#modal')).not_to_be_visible()
            assert server.state()['goals'][0]['saved']==50000
            if file:
                page.locator('.import-link').click()
                page.locator('#import-file').set_input_files(file)
                expect(page.locator('#import-preview')).to_contain_text('0 nouvelles opérations')
                page.get_by_role('button',name='Importer',exact=True).click()
                expect(page.locator('#modal')).not_to_be_visible()
                assert len(server.state()['entries'])==before
            with page.expect_download() as d:page.get_by_role('button',name='Sauvegarder mes données').click()
            download=d.value;dest=Path(tmp)/'backup.json';download.save_as(dest)
            assert len(json.loads(dest.read_text())['entries'])==before
            page.locator('.nav-item[data-page="analysis"]').click()
            expect(page.locator('tbody tr')).to_have_count(12)
            with page.expect_download() as d:page.get_by_role('button',name='Exporter',exact=False).click()
            assert d.value.suggested_filename.endswith('.csv')
            for width in (390,768,1440):
                page.set_viewport_size({'width':width,'height':900})
                for name in ('dashboard','entries','budgets','savings','analysis'):
                    page.locator(f'.nav-item[data-page="{name}"]').click()
                    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),(width,name)
            if test_auth:
                page.get_by_role('button',name='Se déconnecter').click()
                expect(page.locator('#login-form')).to_be_visible()
                assert page.request.get(f'http://127.0.0.1:{http.server_port}/api/state').status==401
            assert not errors,errors
            print('PASS: browser CRUD, persistence, budget overrun, goals, import, exports; 5 pages at 3 widths; no JavaScript errors.')
            browser.close()
    finally:http.shutdown();http.server_close()
