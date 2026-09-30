import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const finance=JSON.parse(await readFile(new URL('public/data/finance.json',root),'utf8'));
const collection=JSON.parse(await readFile(new URL('public/data/records.json',root),'utf8'));
const ids=new Set();
for(const r of collection.records){
 assert(!ids.has(r.id),'Duplicate record '+r.id);ids.add(r.id);
 assert(r.title&&r.entity&&r.kind&&r.text?.length>0,'Incomplete record '+r.id);
 assert(new URL(r.url).protocol==='https:','Non-HTTPS source');
 assert(/^[a-f0-9]{64}$/.test(r.sha256),'Invalid original hash '+r.id);
 assert(r.archive.startsWith('/sources/')&&!r.archive.includes('..'),'Invalid archive path');
 const bytes=await readFile(new URL('public'+r.archive,root));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),r.archiveSha256||r.sha256,'Archive hash mismatch '+r.id);
 assert(bytes.length<25*1024*1024,'Asset exceeds Cloudflare size limit');
}
assert(ids.has(finance.tax.source));assert(ids.has(finance.operating.source));
const annual=collection.records.find(r=>r.id===finance.operating.source);
for(const key of ['expensesIncludingEncumbrances','encumbrances','otherRevenue','townTaxEffort','totalTaxEffort']){
 const number=finance.operating[key].toLocaleString('en-US');
 assert(annual.text.includes(number),'Missing finance evidence for '+key);
}
for(const d of finance.tax.districts){
 const sum=finance.tax.rates.reduce((s,r)=>s+r.rate,0)+d.rate;
 assert(Math.abs(sum-d.total)<0.000001,'Tax components do not reconcile');
}
console.log('Validated '+collection.records.length+' preserved records, financial-source references, and all tax-rate totals.');
