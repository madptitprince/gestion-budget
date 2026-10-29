"""Read monthly budget workbooks without executing formulas or macros."""
import io
import re
import zipfile
import xml.etree.ElementTree as ET
from decimal import Decimal, ROUND_HALF_UP

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def parse_workbook(raw):
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        if sum(i.file_size for i in z.infolist()) > 30_000_000:
            raise ValueError('Classeur trop volumineux après décompression.')
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS)]
        rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        sheets = ET.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet', NS)
        entries, years, warnings = [], [], []
        for sheet in sheets:
            name = sheet.get('name', '')
            match = re.search(r'\b(20\d{2})\b', name)
            if not match:
                continue
            year = int(match[1]); years.append(year)
            target = rels[sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')]
            target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            root = ET.fromstring(z.read(target))
            kind, group = None, 'Autres'
            for row in root.findall('m:sheetData/m:row', NS):
                cells = {}
                for cell in row:
                    col = re.sub(r'\d', '', cell.get('r', ''))
                    v = cell.find('m:v', NS)
                    val = v.text if v is not None else ''
                    if cell.get('t') == 's' and val:
                        val = strings[int(val)]
                    elif cell.get('t') == 'inlineStr':
                        val = ''.join(cell.find('m:is', NS).itertext())
                    cells[col] = (val, cell.find('m:f', NS) is not None)
                label = (cells.get('A', ('', False))[0] or '').strip()
                upper = label.upper()
                if upper == 'REVENUS': kind, group = 'income', 'Revenus'; continue
                if upper == 'DÉPENSES FIXES': kind, group = 'fixed', 'Autres'; continue
                if upper == 'DÉPENSES VARIABLES': kind, group = 'variable', 'Vie quotidienne'; continue
                if upper.startswith(('TOTAL', 'RESTE')): kind = None; continue
                if not kind or not label: continue
                if label in ('Logement', 'Transport', 'Impôts et investissements', 'Impôts', 'Abonnements et cotisations'):
                    group = label; continue
                entry_kind = 'saving' if re.search(r'épargne|DCA|^Actions$', label, re.I) else kind
                category = group
                if entry_kind == 'saving': category = 'Épargne & placements'
                elif kind == 'variable':
                    category = ('Alimentation' if 'alimentaires' in label and 'non-' not in label else
                                'Sorties & loisirs' if any(w in label.lower() for w in ('restaurants', 'spectacles', 'sport', 'jeux')) else
                                'Shopping' if any(w in label.lower() for w in ('vêtements', 'matériel')) else
                                'Voyages' if 'voyages' in label else
                                'Formation & permis' if any(w in label.lower() for w in ('formation', 'permis')) else 'Autres')
                elif label == 'Crédits conso': category = 'Crédits'
                for month, col in enumerate('BCDEFGHIJKLM', 1):
                    value, formula = cells.get(col, ('', False))
                    if not value: continue
                    if formula:
                        warnings.append(f'{name}, {col}{row.get("r")} : formule ignorée.'); continue
                    try: amount = int((Decimal(value) * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
                    except Exception: continue
                    if not amount: continue
                    if amount < 0: raise ValueError('Les montants négatifs ne sont pas pris en charge par cet import.')
                    period = f'{year:04d}-{month:02d}'
                    entries.append({'label': label, 'period': period, 'amount': amount, 'kind': entry_kind,
                                    'category': category, 'note': f'Import Excel · {name} · {col}{row.get("r")}',
                                    'import_key': f'excel:{year}:{month}:{row.get("r")}:{label}'})
        if not years: raise ValueError('Aucune feuille de budget annuel reconnue (ex. Budget mensuel 2026).')
        return {'entries': entries, 'years': sorted(set(years)), 'warnings': warnings}
