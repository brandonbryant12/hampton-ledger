import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile),
  root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform !== 'darwin')
  throw Error(
    'This finance-excerpt helper uses macOS PDFKit. On Linux use a reviewed PDF extraction tool and preserve the same original and excerpt hashes; the main collector supports Poppler.',
  );
const specs = [
  { year: 2024, start: 152, end: 154, item: 4585, printed: '146–148' },
  { year: 2025, start: 211, end: 213, item: 4586, printed: '205–207' },
];
const data = JSON.parse(await readFile(resolve(root, 'public/data/records.json'), 'utf8'));
await mkdir(resolve(root, 'artifacts'), { recursive: true });
for (const spec of specs) {
  const url = 'https://hamptonnh.gov/Archive/ViewFile/Item/' + spec.item;
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw Error('HTTP ' + response.status);
  const original = Buffer.from(await response.arrayBuffer());
  if (original.subarray(0, 5).toString() !== '%PDF-') throw Error('Expected a PDF');
  const originalSha = createHash('sha256').update(original).digest('hex');
  const input = resolve(root, 'artifacts/hampton-annual-report-' + spec.year + '.pdf');
  const temp = resolve(root, 'artifacts/finance-' + spec.year + '-excerpt.pdf');
  await writeFile(input, original);
  const result = await exec(
    'osascript',
    [
      '-l',
      'JavaScript',
      resolve(root, 'scripts/pdf-excerpt.jxa'),
      input,
      String(spec.start),
      String(spec.end),
      temp,
    ],
    { timeout: 60000, maxBuffer: 2000000 },
  );
  const pages = JSON.parse(result.stdout);
  if (!pages.some((p) => p.text.includes('Report of the Finance Department')))
    throw Error('Page mapping changed; manual review required');
  const bytes = await readFile(temp),
    hash = createHash('sha256').update(bytes).digest('hex');
  const archive = '/sources/hampton-' + spec.year + '-finance-' + hash.slice(0, 12) + '.pdf';
  await writeFile(resolve(root, 'public' + archive), bytes);
  const record = {
    id: 'hampton-annual-' + spec.year,
    title: spec.year + ' town finance report',
    category: 'Finance',
    entity: 'Town of Hampton',
    period: spec.year + ' fiscal year',
    kind: 'Annual-report excerpt',
    url: url + '#page=' + spec.start,
    description:
      'Finance Department narrative, reported operating expenses, revenues, and fund-balance context. Unaudited current-year summary.',
    format: 'pdf',
    retrievedAt: new Date().toISOString(),
    sha256: originalSha,
    archiveSha256: hash,
    archive,
    preservationNote:
      'Preserved excerpt: printed pages ' +
      spec.printed +
      ' (PDF pages ' +
      spec.start +
      '–' +
      spec.end +
      '). The original hash refers to the full official annual report; the archived excerpt has its own hash. Other sections are not indexed.',
    extraction: 'PDFKit text from selected finance pages',
    text: pages.map((p) => 'Original PDF page ' + p.page + '\n' + p.text).join('\n\n'),
  };
  data.records = data.records.filter((r) => r.id !== record.id);
  data.records.push(record);
}
await writeFile(resolve(root, 'public/data/records.json'), JSON.stringify(data, null, 2) + '\n');
console.log('Finance excerpts refreshed. Review content and reconcile numbers before publication.');
