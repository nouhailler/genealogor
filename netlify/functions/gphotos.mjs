// Generic CORS relay for Google Photos shared-album pages.
// All extraction logic lives in the front-end (src/lib/gphotos.ts); this
// function only fetches the page server-side because browsers are blocked by
// CORS. Restricted to Google Photos hosts so it cannot be abused as an open
// proxy. Portable by design: an Express route, a PHP script or an nginx
// proxy_pass can replace it identically when self-hosting (the front-end
// proxy URL is configurable in the Settings panel).

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
};

const ALLOWED = /^https:\/\/(photos\.app\.goo\.gl|photos\.google\.com)\//;

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const target = new URL(req.url).searchParams.get('url') ?? '';
  if (!ALLOWED.test(target)) {
    return new Response('Paramètre "url" manquant ou hôte non autorisé.', { status: 400, headers: CORS });
  }

  const upstream = await fetch(target, {
    redirect: 'follow',
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; Genealogor)' },
  });
  const html = await upstream.text();
  return new Response(html, {
    status: upstream.status,
    headers: { ...CORS, 'content-type': 'text/plain; charset=utf-8' },
  });
};
