import sys, json, pathlib
from pypdf import PdfReader, PdfWriter
root=pathlib.Path(__file__).resolve().parents[1]
reader=PdfReader(root/'artifacts/hampton-annual-report-2024.pdf')
pages=[{'page':i+1,'text':p.extract_text() or ''} for i,p in enumerate(reader.pages)]
(root/'artifacts/annual-pages.json').write_text(json.dumps(pages))
selected=[p for p in pages if 'Report of the Finance Department' in p['text'] or 'Total for Department:' in p['text']]
print(json.dumps([{'page':p['page'],'text':p['text'][:1800]} for p in selected]))
writer=PdfWriter()
for p in selected:
 if p['page']>100: writer.add_page(reader.pages[p['page']-1])
with open(root/'public/sources/hampton-2024-finance-excerpt.pdf','wb') as f: writer.write(f)
