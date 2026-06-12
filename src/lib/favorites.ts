// Favorites & recently-viewed stores (localStorage-backed), plus haptic helper.
// All useFavorites/useRecentlyViewed hook instances share the same source of
// truth: changes are broadcast via window events so every subscriber re-reads.
import { useState, useEffect, useCallback } from 'react';

const FAV_KEY = 'genealogor.favorites';
const RECENT_KEY = 'genealogor.recent';
const RECENT_MAX = 12;
const FAV_EVENT = 'genealogor-favorites-changed';
const RECENT_EVENT = 'genealogor-recent-changed';

// ── Haptic feedback (Vibration API — no-op where unsupported) ────────────────

const HAPTIC_PATTERNS: Record<string, number | number[]> = {
  tap: 5,
  light: 8,
  medium: 14,
  heavy: 24,
  success: [10, 40, 10],
  warn: [20, 30, 20],
  error: [30, 60, 30, 60, 30],
};

export type HapticLevel = keyof typeof HAPTIC_PATTERNS;

export function haptic(level: HapticLevel = 'light'): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  try { navigator.vibrate(HAPTIC_PATTERNS[level] ?? 8); } catch { /* unsupported */ }
}

// ── Favorites ─────────────────────────────────────────────────────────────────

export function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

function saveFavorites(set: Set<string>): void {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(set))); } catch { /* quota */ }
}

export function clearFavorites(): void {
  try { localStorage.removeItem(FAV_KEY); } catch { /* ignore */ }
  window.dispatchEvent(new Event(FAV_EVENT));
}

export interface FavoritesStore {
  favorites: Set<string>;
  isFav: (id: string) => boolean;
  toggleFav: (id: string) => void;
}

export function useFavorites(): FavoritesStore {
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);
  useEffect(() => {
    const cb = () => setFavorites(loadFavorites());
    window.addEventListener(FAV_EVENT, cb);
    window.addEventListener('storage', cb);
    return () => {
      window.removeEventListener(FAV_EVENT, cb);
      window.removeEventListener('storage', cb);
    };
  }, []);
  const isFav = useCallback((id: string) => favorites.has(id), [favorites]);
  const toggleFav = useCallback((id: string) => {
    const next = loadFavorites();
    if (next.has(id)) { next.delete(id); haptic('light'); }
    else { next.add(id); haptic('success'); }
    saveFavorites(next);
    window.dispatchEvent(new Event(FAV_EVENT));
  }, []);
  return { favorites, isFav, toggleFav };
}

// ── Recently viewed ───────────────────────────────────────────────────────────

export function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}

function saveRecent(arr: string[]): void {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, RECENT_MAX))); } catch { /* quota */ }
}

export function clearRecent(): void {
  try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ }
  window.dispatchEvent(new Event(RECENT_EVENT));
}

export interface RecentStore {
  recent: string[];
  push: (id: string) => void;
  clear: () => void;
}

export function useRecentlyViewed(): RecentStore {
  const [recent, setRecent] = useState<string[]>(loadRecent);
  useEffect(() => {
    const cb = () => setRecent(loadRecent());
    window.addEventListener(RECENT_EVENT, cb);
    return () => window.removeEventListener(RECENT_EVENT, cb);
  }, []);
  const push = useCallback((id: string) => {
    if (!id) return;
    const next = [id, ...loadRecent().filter((x) => x !== id)].slice(0, RECENT_MAX);
    saveRecent(next);
    window.dispatchEvent(new Event(RECENT_EVENT));
  }, []);
  const clear = useCallback(() => clearRecent(), []);
  return { recent, push, clear };
}
