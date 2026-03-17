"""Read xlsx without openpyxl — uses only built-in zipfile + xml"""
import zipfile, xml.etree.ElementTree as ET, re, json

XLSX = 'public/SunNxt Data Dictionary.xlsx'

def read_xlsx(path):
    with zipfile.ZipFile(path) as z:
        # shared strings
        shared = []
        if 'xl/sharedStrings.xml' in z.namelist():
            tree = ET.parse(z.open('xl/sharedStrings.xml'))
            for si in tree.getroot().iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
                t = ''.join(n.text or '' for n in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'))
                shared.append(t)

        # workbook sheet names
        wb_tree = ET.parse(z.open('xl/workbook.xml'))
        ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
        sheets = []
        for s in wb_tree.getroot().iter(f'{ns}sheet'):
            sheets.append({'name': s.get('name'), 'id': s.get('sheetId'), 'rid': s.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')})

        # rels
        rels = {}
        if 'xl/_rels/workbook.xml.rels' in z.namelist():
            rt = ET.parse(z.open('xl/_rels/workbook.xml.rels'))
            for r in rt.getroot():
                rels[r.get('Id')] = r.get('Target')

        result = {}
        for sh in sheets:
            target = rels.get(sh['rid'], '')
            fname = f"xl/{target}" if not target.startswith('/') else target[1:]
            if fname not in z.namelist():
                continue
            ws_tree = ET.parse(z.open(fname))
            rows_data = []
            for row in ws_tree.getroot().iter(f'{ns}row'):
                row_vals = []
                for c in row.iter(f'{ns}c'):
                    t = c.get('t', '')
                    v_el = c.find(f'{ns}v')
                    val = ''
                    if v_el is not None and v_el.text is not None:
                        if t == 's':
                            idx = int(v_el.text)
                            val = shared[idx] if idx < len(shared) else ''
                        elif t == 'inlineStr':
                            is_el = c.find(f'{ns}is/{ns}t')
                            val = is_el.text if is_el is not None else ''
                        else:
                            val = v_el.text
                    row_vals.append(val)
                if any(v.strip() for v in row_vals):
                    rows_data.append(row_vals)
            result[sh['name']] = rows_data
        return result

data = read_xlsx(XLSX)
print("Sheets:", list(data.keys()))
for sh, rows in data.items():
    print(f"\n=== {sh} ({len(rows)} rows) ===")
    for r in rows[:10]:
        print(r)
