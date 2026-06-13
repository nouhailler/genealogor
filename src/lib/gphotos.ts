// Google Photos shared-album integration.
// A link-shared album page embeds long-lived lh3.googleusercontent.com image
// URLs (resizable with the =wNNN suffix). Browsers cannot fetch that page
// cross-origin, so the fetch goes through a tiny generic relay — a Netlify
// Function by default, configurable for self-hosting (any CORS proxy works:
// Express, PHP, nginx proxy_pass…). All extraction logic lives here, client-side.

const PROXY_KEY = 'genealogor.gphotosProxy';
const CACHE_KEY = 'genealogor.gphotosCache';
const CACHE_TTL = 7 * 24 * 3600 * 1000; // 7 jours

export const DEFAULT_GPHOTOS_PROXY = '/.netlify/functions/gphotos';
export const MAX_GPHOTOS_THUMBS = 10;

// ── Proxy setting (localStorage) ──────────────────────────────────────────────

export function getGPhotosProxy(): string {
  try { return localStorage.getItem(PROXY_KEY) || DEFAULT_GPHOTOS_PROXY; } catch { return DEFAULT_GPHOTOS_PROXY; }
}

export function setGPhotosProxy(url: string): void {
  const v = url.trim();
  try {
    if (v && v !== DEFAULT_GPHOTOS_PROXY) localStorage.setItem(PROXY_KEY, v);
    else localStorage.removeItem(PROXY_KEY);
  } catch { /* ignore */ }
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Accepts the two shapes of Google Photos share links. */
export function isGPhotosAlbumUrl(url: string): boolean {
  return /^https:\/\/(photos\.app\.goo\.gl|photos\.google\.com)\//.test(url.trim());
}

/**
 * Extract unique photo base URLs from a shared-album page.
 * Album photos live under lh3.googleusercontent.com/pw/… ; owner avatars use
 * other path prefixes (/a/, /a-…) and are deliberately excluded.
 */
export function extractAlbumImages(html: string): string[] {
  const re = /https:\/\/lh3\.googleusercontent\.com\/pw\/[A-Za-z0-9_-]+/g;
  return [...new Set(html.match(re) ?? [])];
}

/** Sized variant of a googleusercontent base URL; other URLs pass through unchanged. */
export function gphotoUrl(base: string, width: number): string {
  return /googleusercontent\.com\//.test(base) ? `${base}=w${width}` : base;
}

// ── Fetch + cache ─────────────────────────────────────────────────────────────

interface CacheEntry { urls: string[]; at: number; }

function readCache(): Record<string, CacheEntry> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}'); } catch { return {}; }
}

function writeCache(cache: Record<string, CacheEntry>): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* quota — ignore */ }
}

/**
 * Resolve a shared-album URL to its photo base URLs (max MAX_GPHOTOS_THUMBS),
 * via the proxy, with a 7-day localStorage cache so day-to-day use does not
 * touch the proxy at all.
 */
export async function fetchAlbumImages(albumUrl: string, opts?: { force?: boolean }): Promise<string[]> {
  const cache = readCache();
  const hit = cache[albumUrl];
  if (hit && !opts?.force && Date.now() - hit.at < CACHE_TTL) return hit.urls;

  const proxy = getGPhotosProxy();
  const sep = proxy.includes('?') ? '&' : '?';
  let res: Response;
  try {
    res = await fetch(`${proxy}${sep}url=${encodeURIComponent(albumUrl)}`);
  } catch {
    throw new Error('Proxy injoignable — vérifiez l\'URL du proxy dans les Paramètres (en local, utilisez l\'URL de la fonction Netlify déployée).');
  }
  if (!res.ok) throw new Error(`Le proxy a répondu HTTP ${res.status}.`);
  const html = await res.text();
  const urls = extractAlbumImages(html).slice(0, MAX_GPHOTOS_THUMBS);
  if (urls.length === 0) {
    throw new Error('Aucune photo trouvée — vérifiez que l\'album est bien « partagé par lien » dans Google Photos.');
  }
  cache[albumUrl] = { urls, at: Date.now() };
  writeCache(cache);
  return urls;
}

/** Drop the cached extraction for one album (used by the refresh button). */
export function invalidateAlbumCache(albumUrl: string): void {
  const cache = readCache();
  if (albumUrl in cache) { delete cache[albumUrl]; writeCache(cache); }
}
