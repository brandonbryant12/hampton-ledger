import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.mjs';
test('health identifies the deployed code and collection without caching', async () => {
  const res = await worker.fetch(new Request('https://example.com/api/health'), {
    RELEASE_SHA: 'abc',
    COLLECTION_SHA: 'def',
  });
  assert.deepEqual(await res.json(), {
    service: 'hampton-ledger',
    release: 'abc',
    collection: 'def',
  });
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
});
test('the public worker rejects state-changing methods', async () => {
  const res = await worker.fetch(new Request('https://example.com/', { method: 'POST' }), {});
  assert.equal(res.status, 405);
});
test('archived HTML cannot execute as a page', async () => {
  const res = await worker.fetch(new Request('https://example.com/sources/source.html.txt'), {
    ASSETS: {
      fetch: async () =>
        new Response('<script>alert(1)</script>', { headers: { 'Content-Type': 'text/html' } }),
    },
  });
  assert.match(res.headers.get('Content-Type'), /^text\/plain/);
  assert.equal(res.headers.get('Content-Disposition'), 'attachment');
  assert.match(res.headers.get('Content-Security-Policy'), /script-src 'self'/);
});
test('missing assets retain their 404 status', async () => {
  const res = await worker.fetch(new Request('https://example.com/missing'), {
    ASSETS: { fetch: async () => new Response('Not found', { status: 404 }) },
  });
  assert.equal(res.status, 404);
});
