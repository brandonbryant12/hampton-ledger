import { money, escapeHtml as e, taxBreakdown, searchRecords, csv } from './lib.mjs';
const $ = (s) => document.querySelector(s);
let finance, collection, records, lastFocus;
const date = (s) =>
  new Date(s).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
const icons = { Finance: 'DATA', Meetings: 'DOC', Procurement: 'BID', Schools: 'DOC' };
const download = (name, body, type = 'text/plain') => {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function navigate() {
  const valid = ['overview', 'taxes', 'spending', 'records', 'about'];
  const [raw, query = ''] = location.hash.slice(1).split('?');
  const route = valid.includes(raw) ? raw : 'overview';
  document.querySelectorAll('.page').forEach((p) => (p.hidden = p.id !== route));
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === route) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title =
    {
      overview: 'Follow your public dollars',
      taxes: 'Your taxes, explained',
      spending: 'Town spending',
      records: 'The evidence library',
      about: 'Our method',
    }[route] + ' — Hampton Ledger';
  if (route === 'records') {
    const q = new URLSearchParams(query).get('q');
    if (q !== null) $('#record-search').value = q;
    renderRecords();
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
  $('#main').focus({ preventScroll: true });
}
function renderPreview() {
  $('#preview-bar').innerHTML = finance.tax.rates
    .map(
      (r) =>
        '<span style="width:' +
        (r.rate / 12.61) * 100 +
        '%;background:' +
        r.color +
        '" title="' +
        e(r.label) +
        '"></span>',
    )
    .join('');
  $('#preview-bar').setAttribute(
    'aria-label',
    finance.tax.rates
      .map((r) => r.label + ' ' + ((r.rate / 12.61) * 100).toFixed(1) + ' percent')
      .join(', '),
  );
  $('#preview-legend').innerHTML = finance.tax.rates
    .map(
      (r) =>
        '<div class="preview-item"><span class="color-dot" style="background:' +
        r.color +
        '"></span><span>' +
        e(r.label) +
        '</span><strong>' +
        ((r.rate / 12.61) * 100).toFixed(1) +
        '%</strong></div>',
    )
    .join('');
  $('#featured-records').innerHTML = ['hampton-assessing', 'hampton-annual-2025', 'hampton-agendas']
    .map((id) => records.find((r) => r.id === id))
    .filter(Boolean)
    .map(
      (r) =>
        '<button class="evidence-card" data-record="' +
        r.id +
        '"><span class="file-mark" aria-hidden="true">' +
        (icons[r.category] || 'DOC') +
        '</span><h3>' +
        e(r.title) +
        '</h3><p>' +
        e(r.description) +
        '</p><span class="card-bottom"><span>' +
        e(r.category) +
        ' · ' +
        e(r.kind) +
        '</span><span aria-hidden="true">↗</span></span></button>',
    )
    .join('');
}
function renderTaxes() {
  try {
    const raw = $('#property-value').value.trim();
    if (!raw) throw new Error('Enter an assessed property value.');
    const value = Number(raw);
    const data = taxBreakdown(value, $('#tax-district').value, finance.tax);
    $('#tax-error').textContent = '';
    $('#property-value').removeAttribute('aria-invalid');
    $('#download-tax').disabled = false;
    $('#annual-tax').textContent = money(data.total);
    $('#tax-rate-label').textContent = money(data.rate, 2) + ' per $1,000 of assessed value';
    let offset = 0;
    const radius = 126,
      circumference = 2 * Math.PI * radius;
    $('#tax-donut').innerHTML = data.rows
      .map((r) => {
        const length = (r.rate / data.rate) * circumference;
        const visible = length - Math.min(4, length * 0.2);
        const path =
          '<circle cx="160" cy="160" r="' +
          radius +
          '" fill="none" stroke="' +
          r.color +
          '" stroke-width="26" stroke-dasharray="' +
          visible +
          ' ' +
          (circumference - visible) +
          '" stroke-dashoffset="' +
          -offset +
          '"><title>' +
          e(r.label) +
          ': ' +
          money(r.amount) +
          '</title></circle>';
        offset += length;
        return path;
      })
      .join('');
    $('#tax-donut').setAttribute(
      'aria-label',
      'Tax allocation: ' + data.rows.map((r) => r.label + ' ' + money(r.amount)).join(', '),
    );
    $('#tax-breakdown').innerHTML = data.rows
      .map(
        (r) =>
          '<div class="tax-row"><span class="color-dot" style="background:' +
          r.color +
          '"></span><div><div class="tax-row-label">' +
          e(r.label) +
          '</div><div class="tax-row-detail">' +
          ((r.rate / data.rate) * 100).toFixed(1) +
          '% of this bill</div></div><div class="tax-row-amount">' +
          money(r.amount) +
          '<small>' +
          money(r.rate, 2) +
          ' / $1,000</small></div></div>',
      )
      .join('');
  } catch (err) {
    $('#tax-error').textContent = err.message;
    $('#property-value').setAttribute('aria-invalid', 'true');
    $('#download-tax').disabled = true;
    $('#annual-tax').textContent = '—';
    $('#tax-rate-label').textContent = 'Enter a valid value to calculate.';
    $('#tax-breakdown').innerHTML = '';
    $('#tax-donut').innerHTML = '';
  }
}
function renderSpending() {
  const d =
    finance.history.find((r) => r.year === Number($('#spending-year').value)) || finance.operating;
  $('#spending-source').dataset.record = d.source;
  $('#budget-percent').textContent = d.percentBudgetUsed.toFixed(2) + '%';
  $('#budget-remainder').textContent = (100 - d.percentBudgetUsed).toFixed(2) + '%';
  $('#budget-fill').style.width = d.percentBudgetUsed + '%';
  $('#operating-total').textContent = money(d.expensesIncludingEncumbrances);
  $('#encumbrance-total').textContent = money(d.encumbrances);
  $('#spending-limitations').textContent = d.limitations;
  const rows = [
    [
      'Other reported revenue',
      'Motor vehicles, permits, parking, state distributions, trust income, and other sources.',
      d.otherRevenue,
    ],
    [
      'Town property-tax effort',
      'The town’s portion of the reported property-tax effort.',
      d.townTaxEffort,
    ],
    [
      'Total property-tax effort',
      'Reported overall tax effort, including other taxing bodies. This is not town operating spending.',
      d.totalTaxEffort,
    ],
  ];
  if (d.warrantExpensesIncludingEncumbrances)
    rows.push([
      'Warrant-article expenditures',
      'Reported separately, including purchase orders. Excluded from the operating expense total above.',
      d.warrantExpensesIncludingEncumbrances,
    ]);
  $('#finance-rows').innerHTML = rows
    .map(
      ([title, desc, value]) =>
        '<div class="finance-row"><h3>' +
        e(title) +
        '</h3><p>' +
        e(desc) +
        '</p><strong>' +
        money(value) +
        '</strong></div>',
    )
    .join('');
}
function renderRecords() {
  const query = $('#record-search').value;
  const filtered = searchRecords(records, query, $('#record-category').value);
  $('#record-count').textContent =
    filtered.length + ' of ' + records.length + ' collected records and directories';
  $('#records-empty').hidden = filtered.length > 0;
  $('#record-results').innerHTML = filtered
    .map(
      (r) =>
        '<article class="record-row" data-open="' +
        r.id +
        '"><span class="file-mark" aria-hidden="true">' +
        (r.format === 'pdf' ? 'PDF' : icons[r.category] || 'DOC') +
        '</span><div><h2><button data-record="' +
        r.id +
        '">' +
        e(r.title) +
        '</button></h2><p>' +
        e(r.description) +
        '</p></div><div class="record-entity"><span class="record-category">' +
        e(r.category) +
        '</span>' +
        e(r.entity) +
        '</div><div class="record-date">Collected<br>' +
        date(r.retrievedAt) +
        '</div><span class="row-arrow" aria-hidden="true">↗</span></article>',
    )
    .join('');
}
function openRecord(id) {
  const r = records.find((r) => r.id === id);
  if (!r) return;
  lastFocus = document.activeElement;
  $('#dialog-title').textContent = r.title;
  $('#dialog-category').textContent = r.category + ' / ' + r.kind;
  $('#dialog-description').textContent = r.description;
  $('#dialog-meta').innerHTML =
    '<span>' +
    e(r.entity) +
    '</span><span>Collected ' +
    date(r.retrievedAt) +
    '</span><span>' +
    e(r.period || 'Source directory') +
    '</span>';
  $('#dialog-links').innerHTML =
    '<a class="button primary" href="' +
    e(r.url) +
    '" target="_blank" rel="noopener noreferrer">Open official source ↗</a>' +
    (r.archive
      ? '<a class="button outline" href="' +
        e(r.archive) +
        '" download>Download preserved copy ↓</a>'
      : '');
  $('#dialog-provenance').innerHTML =
    '<p><strong>SHA-256 of retrieved original</strong><br>' +
    e(r.sha256 || 'Not available') +
    '</p><p>' +
    e(
      r.preservationNote ||
        (r.format === 'pdf'
          ? 'The archived PDF is a byte-for-byte copy of the retrieved official source.'
          : 'HTML snapshots are stored as plain text so archived third-party scripts cannot execute on this site.'),
    ) +
    '</p><p>Extraction: ' +
    e(r.extraction || 'Main page text') +
    '.</p>';
  $('#dialog-text').textContent =
    r.text || 'Searchable text is not available. Open the official source for the full record.';
  $('#record-dialog').showModal();
  document.body.classList.add('no-scroll');
}
function closeRecord() {
  $('#record-dialog').close();
}
function renderRequests() {
  $('#request-list').innerHTML = collection.requests
    .map(
      (r) =>
        '<div class="request-item"><h3>' +
        e(r.title) +
        '</h3><p>' +
        e(r.description) +
        '</p><span class="tag pending">Planned · not sent</span></div>',
    )
    .join('');
}
function wire() {
  window.addEventListener('hashchange', navigate);
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-record]');
    if (button) {
      openRecord(button.dataset.record);
      return;
    }
    const row = event.target.closest('[data-open]');
    if (row && !event.target.closest('a,button')) openRecord(row.dataset.open);
  });
  $('#tax-form').addEventListener('submit', (event) => event.preventDefault());
  $('#property-value').addEventListener('input', () => {
    $('#value-range').value = $('#property-value').value;
    renderTaxes();
  });
  $('#value-range').addEventListener('input', () => {
    $('#property-value').value = $('#value-range').value;
    renderTaxes();
  });
  $('#tax-district').addEventListener('change', renderTaxes);
  $('#spending-year').addEventListener('change', renderSpending);
  $('#record-search').addEventListener('input', renderRecords);
  $('#record-category').addEventListener('change', renderRecords);
  $('#clear-search').addEventListener('click', () => {
    $('#record-search').value = '';
    $('#record-category').value = 'all';
    renderRecords();
    $('#record-search').focus();
  });
  $('#close-dialog').addEventListener('click', closeRecord);
  $('#record-dialog').addEventListener('click', (event) => {
    if (event.target === $('#record-dialog')) {
      const r = event.target.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        closeRecord();
    }
  });
  $('#record-dialog').addEventListener('close', () => {
    document.body.classList.remove('no-scroll');
    lastFocus?.focus();
  });
  document.addEventListener('keydown', (event) => {
    if (
      event.key === '/' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) &&
      !$('#record-dialog').open
    ) {
      event.preventDefault();
      if (location.hash !== '#records') {
        location.hash = 'records';
        setTimeout(() => $('#record-search').focus(), 30);
      } else $('#record-search').focus();
    }
  });
  $('#download-tax').addEventListener('click', () => {
    const d = taxBreakdown(
      Number($('#property-value').value),
      $('#tax-district').value,
      finance.tax,
    );
    download(
      'hampton-tax-illustration-2025.csv',
      csv([
        ['Hampton Ledger — 2025 tax illustration'],
        ['Assessed value', $('#property-value').value],
        ['Category', $('#tax-district').selectedOptions[0].text],
        ['Component', 'Rate per $1,000', 'Annual amount'],
        ...d.rows.map((r) => [r.label, r.rate.toFixed(2), r.amount.toFixed(2)]),
        ['Total', d.rate.toFixed(2), d.total.toFixed(2)],
        ['Source', 'https://hamptonnh.gov/153/Assessing'],
        ['Limitations', finance.tax.note],
      ]),
      'text/csv',
    );
  });
  $('#download-index').addEventListener('click', () =>
    download(
      'hampton-record-index.csv',
      csv([
        [
          'ID',
          'Title',
          'Category',
          'Entity',
          'Kind',
          'Period',
          'Retrieved',
          'Official URL',
          'Archive',
          'Original SHA-256',
        ],
        ...searchRecords(records, $('#record-search').value, $('#record-category').value).map(
          (r) => [
            r.id,
            r.title,
            r.category,
            r.entity,
            r.kind,
            r.period,
            r.retrievedAt,
            r.url,
            r.archive,
            r.sha256,
          ],
        ),
      ]),
      'text/csv',
    ),
  );
  $('#download-request').addEventListener('click', async () => {
    try {
      const r = await fetch('/data/records-request-draft.txt');
      if (!r.ok) throw Error('Request template unavailable');
      download('hampton-records-request-DRAFT.txt', await r.text());
    } catch (err) {
      $('#download-request').textContent = 'Unable to download. Please try again.';
    }
  });
}
try {
  const responses = await Promise.all([fetch('/data/finance.json'), fetch('/data/records.json')]);
  if (responses.some((r) => !r.ok)) throw Error('The collection could not be loaded.');
  [finance, collection] = await Promise.all(responses.map((r) => r.json()));
  records = collection.records;
  $('#tax-district').innerHTML = finance.tax.districts
    .map((d) => '<option value="' + d.id + '">' + e(d.label) + '</option>')
    .join('');
  $('#tax-limitations').textContent = finance.tax.note;
  $('#coverage-count').textContent = records.length + ' sources';
  document
    .querySelectorAll('[data-collection-date]')
    .forEach((x) => (x.textContent = date(collection.collectedAt)));
  renderPreview();
  renderTaxes();
  renderSpending();
  renderRequests();
  wire();
  $('#app-status').hidden = true;
  navigate();
} catch (err) {
  $('#app-status').classList.add('error');
  $('#app-status').innerHTML =
    '<h1>We couldn’t open the ledger.</h1><p>Please refresh to try again. The original public records remain available.</p><a href="https://hamptonnh.gov/451/Document-Central">Visit Hampton’s document center</a>';
  console.error(err);
}
