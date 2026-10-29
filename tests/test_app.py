import io
import os
from unittest.mock import patch
import json
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
import zipfile
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import server
from importer import parse_workbook

def workbook():
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w') as z:
        z.writestr('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Budget mensuel 2026" sheetId="1" r:id="r1"/></sheets></workbook>')
        z.writestr('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>')
        rows=[(3,'REVENUS',None),(4,'Salaire','1000.01'),(13,'TOTAL REVENUS','1000.01'),(15,'DÉPENSES FIXES',None),(16,'Logement',None),(17,'Loyer','240'),(35,'Épargne Livret A','150'),(58,'TOTAL DÉPENSES FIXES','390'),(62,'DÉPENSES VARIABLES',None),(63,'Courses alimentaires','100'),(70,'Restaurants / bars','0'),(83,'TOTAL DÉPENSES VARIABLES','100')]
        xml='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
        for n,label,value in rows:
            xml+=f'<row r="{n}"><c r="A{n}" t="inlineStr"><is><t>{label}</t></is></c>'
            if value is not None: xml+=f'<c r="B{n}"><v>{value}</v></c>'
            xml+='</row>'
        z.writestr('xl/worksheets/sheet1.xml',xml+'</sheetData></worksheet>')
    return out.getvalue()

class AppTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.env=patch.dict(os.environ,{"DATABASE_URL":"", "budget_DATABASE_URL":"", "VERCEL":"", "BUDGET_PASSWORD":""});cls.env.start()
        cls.temp=tempfile.TemporaryDirectory();server.DB=Path(cls.temp.name)/'test.sqlite3';server.init_db()
        cls.http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        threading.Thread(target=cls.http.serve_forever,daemon=True).start()
        cls.base=f'http://127.0.0.1:{cls.http.server_port}'
    @classmethod
    def tearDownClass(cls): cls.http.shutdown();cls.http.server_close();cls.temp.cleanup();cls.env.stop()
    def setUp(self):
        with server.connect() as db:
            for table in ('entries','budgets','goals'):db.execute('DELETE FROM '+table)
    def request(self,path,method='GET',body=None,origin=None):
        headers={'Content-Type':'application/json'}
        if origin:headers['Origin']=origin
        req=urllib.request.Request(self.base+'/api/'+path,data=json.dumps(body).encode() if body is not None else None,method=method,headers=headers)
        try:
            with urllib.request.urlopen(req) as r:return r.status,r.read()
        except urllib.error.HTTPError as e:return e.code,e.read()
    def entry(self,**kw):return dict(label='Courses',period='2026-10',amount=12345,kind='variable',category='Alimentation',note='',**kw)
    def test_create_update_delete_persist(self):
        self.assertEqual(self.request('entries','POST',self.entry())[0],200)
        e=server.state()['entries'][0];self.assertEqual(e['amount'],12345)
        e['amount']=15750
        self.assertEqual(self.request(f'entries/{e["id"]}','PUT',e)[0],200)
        self.assertEqual(json.loads(self.request('state')[1])['entries'][0]['amount'],15750)
        self.assertEqual(self.request(f'entries/{e["id"]}','DELETE')[0],200)
        self.assertEqual(server.state()['entries'],[])
    def test_money_and_period_validation(self):
        for key,value in [('amount',-1),('amount',1.1),('amount',True),('period','2026-13'),('kind','unknown')]:
            e=self.entry();e[key]=value
            self.assertEqual(self.request('entries','POST',e)[0],400)
    def test_budget_unique_per_month(self):
        b=dict(period='2026-10',category='Alimentation',amount=20000)
        self.assertEqual(self.request('budgets','POST',b)[0],200)
        self.assertEqual(self.request('budgets','POST',b)[0],409)
        b['period']='2026-11';self.assertEqual(self.request('budgets','POST',b)[0],200)
    def test_goals_independent_of_entries(self):
        self.assertEqual(self.request('goals','POST',dict(label='Voyage',target=100000,saved=25000,deadline='2027-06'))[0],200)
        self.assertEqual(server.state()['goals'][0]['saved'],25000)
        self.assertEqual(server.state()['entries'],[])
    def test_import_skips_totals_and_is_idempotent(self):
        p=parse_workbook(workbook());self.assertEqual(len(p['entries']),4)
        self.assertEqual(sum(e['amount'] for e in p['entries'] if e['kind']=='income'),100001)
        self.assertEqual(sum(e['amount'] for e in p['entries'] if e['kind']=='saving'),15000)
        self.assertEqual(server.import_entries(p),4)
        with server.connect() as db:db.execute("UPDATE entries SET amount=777 WHERE kind='saving'")
        self.assertEqual(server.import_entries(p),0)
        self.assertEqual(next(e for e in server.state()['entries'] if e['kind']=='saving')['amount'],777)
    def test_cross_origin_write_rejected(self):
        self.assertEqual(self.request('entries','POST',self.entry(),origin='https://example.org')[0],403)
        self.assertEqual(server.state()['entries'],[])
    def test_csv_formula_escaped_and_backup_complete(self):
        e=self.entry();e['label']='=HYPERLINK("https://example.org")';self.request('entries','POST',e)
        status,csv=self.request('export');self.assertEqual(status,200);self.assertIn(b"'=HYPERLINK",csv)
        backup=json.loads(self.request('backup')[1]);self.assertEqual(backup['version'],1);self.assertEqual(len(backup['entries']),1)
    def test_private_files_not_served(self):
        with self.assertRaises(urllib.error.HTTPError) as err:urllib.request.urlopen(self.base+'/.data/budget.sqlite3')
        self.assertEqual(err.exception.code,404)
if __name__=='__main__':unittest.main(verbosity=2)
