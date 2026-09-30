const headers = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
};
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!['GET', 'HEAD'].includes(request.method))
      return new Response('Method not allowed', {
        status: 405,
        headers: { ...headers, Allow: 'GET, HEAD' },
      });
    if (url.pathname === '/api/health')
      return new Response(
        request.method === 'HEAD'
          ? null
          : JSON.stringify({
              service: 'hampton-ledger',
              release: env.RELEASE_SHA,
              collection: env.COLLECTION_SHA,
            }),
        {
          headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        },
      );
    const asset = await env.ASSETS.fetch(request);
    const response = new Response(asset.body, asset);
    for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
    if (url.pathname.endsWith('.html.txt')) {
      response.headers.set('Content-Type', 'text/plain; charset=utf-8');
      response.headers.set('Content-Disposition', 'attachment');
    }
    response.headers.set(
      'Cache-Control',
      url.pathname.startsWith('/sources/')
        ? 'public, max-age=86400'
        : 'public, max-age=0, must-revalidate',
    );
    return response;
  },
};
