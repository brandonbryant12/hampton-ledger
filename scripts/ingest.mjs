import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(resolve(root, 'data/sources.json'), 'utf8'));
const target = resolve(root, 'public/data/records.json');
const existing = await readFile(target, 'utf8')
  .then(JSON.parse)
  .catch(() => ({ records: [] }));
const byId = new Map(existing.records.map((r) => [r.id, r]));
const decode = (s) =>
  s
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&thinsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
function textOf(html) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  const article = html.match(/<div[^>]*id="(?:divRef|structuralContainer5)"[^>]*>([\s\S]*)/i)?.[1];
  return decode(
    (main || article || html)
      .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<\/(p|div|li|h[1-6]|tr|section)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim(),
  );
}
async function getBytes(url) {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'HamptonLedger/0.1 (+https://github.com/brandonbryant12/hampton-ledger)',
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw Error('HTTP ' + r.status);
    return Buffer.from(await r.arrayBuffer());
  } catch (error) {
    // The system trust store can resolve chains unavailable in Node's bundled store.
    // curl still verifies certificates: never use --insecure or disable TLS validation.
    if (
      !['UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(
        error.cause?.code,
      )
    )
      throw error;
    const result = await exec(
      'curl',
      ['--fail', '--location', '--silent', '--show-error', '--max-time', '45', url],
      { encoding: 'buffer', maxBuffer: 8000000, timeout: 50000 },
    );
    return result.stdout;
  }
}
function discoverMeetings(html) {
  return [...html.matchAll(/<tr[^>]*class="catAgendaRow"[^>]*>([\s\S]*?)<\/tr>/g)]
    .flatMap((m) => {
      const a = m[1].match(
        /href="(\/AgendaCenter\/ViewFile\/Agenda\/[^"?]+)"[^>]*>\s*([^<]+)<\/a>/,
      );
      const minutes = m[1].match(
        /href="(\/AgendaCenter\/ViewFile\/Minutes\/[^"?]+)"\s+aria-label="([^"]+)"/,
      );
      if (!a || !/Select|Budget/i.test(a[2])) return [];
      const stamp = a[1].match(/_(\d{8})/)[1],
        day = stamp.slice(4) + '-' + stamp.slice(0, 2) + '-' + stamp.slice(2, 4);
      return [
        {
          id: 'meeting-' + (minutes ? 'minutes' : 'agenda') + '-' + a[1].split('-').at(-1),
          url: 'https://hamptonnh.gov' + (minutes?.[1] || a[1]),
          title: decode((minutes?.[2] || a[2].trim() + ' — ' + day).replace(/\.\. /g, '. ')),
          kind: minutes ? 'Meeting minutes' : 'Meeting agenda',
          category: 'Meetings',
          entity: /Budget/i.test(a[2]) ? 'Hampton Budget Committee' : 'Hampton Select Board',
          period: day,
          description: minutes
            ? 'Official published meeting minutes. Search the extracted text or inspect the original PDF.'
            : 'Official meeting agenda. An agenda records planned business, not adopted decisions.',
        },
      ];
    })
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, config.meetingLimit || 12);
}
const queue = [...config.sources],
  seen = new Set(),
  errors = [];
for (const source of queue) {
  if (seen.has(source.id)) continue;
  seen.add(source.id);
  try {
    const bytes = await getBytes(source.url);
    if (bytes.length > 8000000) throw Error('Source exceeds collection limit; requires review');
    const isPdf = bytes.subarray(0, 5).toString() === '%PDF-';
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const archive =
      '/sources/' + source.id + '-' + sha256.slice(0, 12) + (isPdf ? '.pdf' : '.html.txt');
    await mkdir(resolve(root, 'public/sources'), { recursive: true });
    await writeFile(resolve(root, 'public' + archive), bytes);
    let text, extraction;
    if (isPdf) {
      if (process.platform === 'darwin') {
        const result = await exec(
          'osascript',
          [
            '-l',
            'JavaScript',
            resolve(root, 'scripts/pdf-text.jxa'),
            resolve(root, 'public' + archive),
          ],
          { timeout: 60000, maxBuffer: 5000000 },
        );
        text = result.stdout.trim();
        extraction = 'PDFKit text with original PDF page markers';
      } else {
        const result = await exec(
          'pdftotext',
          ['-layout', resolve(root, 'public' + archive), '-'],
          { timeout: 60000, maxBuffer: 5000000 },
        );
        text = result.stdout.trim();
        extraction = 'Poppler pdftotext -layout';
      }
    } else {
      const html = bytes.toString('utf8');
      if (!/<html|<!doctype/i.test(html)) throw Error('Expected HTML or PDF');
      text = textOf(html);
      extraction = 'HTML text extraction; linked documents are not included';
      if (source.id === 'hampton-agendas' && config.discoverMeetings)
        queue.push(...discoverMeetings(html));
    }
    if (text.length < 100) throw Error('Empty extraction; OCR or manual review required');
    byId.set(source.id, {
      ...source,
      retrievedAt: new Date().toISOString(),
      sha256,
      archive,
      archiveSha256: sha256,
      format: isPdf ? 'pdf' : 'html',
      extraction,
      text,
    });
    console.log('Collected ' + source.id + ' (' + bytes.length + ' bytes)');
  } catch (error) {
    errors.push({ id: source.id, error: error.message });
    console.error(source.id + ': ' + error.message);
  }
}
await mkdir(resolve(root, 'public/data'), { recursive: true });
const records = [...byId.values()].sort(
  (a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title),
);
await writeFile(
  target,
  JSON.stringify(
    {
      collectedAt: new Date().toISOString(),
      schemaVersion: 1,
      records,
      requests: config.requests,
      collectionErrors: errors,
    },
    null,
    2,
  ) + '\n',
);
if (errors.length) process.exitCode = 1;
