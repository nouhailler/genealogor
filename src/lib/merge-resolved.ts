// Resolved duplicate-pairs persistence (localStorage) — used by MergeModal
// and ValidationView to remember which candidate pairs were already handled.

const MERGE_RESOLVED_KEY = 'genealogor.mergesResolved';

function loadResolved(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(MERGE_RESOLVED_KEY) || '[]') as string[]); }
  catch { return new Set(); }
}
function saveResolved(set: Set<string>): void {
  try { localStorage.setItem(MERGE_RESOLVED_KEY, JSON.stringify(Array.from(set))); } catch { /* ignore */ }
}
function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

export function isResolved(idA: string, idB: string): boolean {
  return loadResolved().has(pairKey(idA, idB));
}
export function markResolved(idA: string, idB: string): void {
  const s = loadResolved(); s.add(pairKey(idA, idB)); saveResolved(s);
}
export function unmarkResolved(idA: string, idB: string): void {
  const s = loadResolved(); s.delete(pairKey(idA, idB)); saveResolved(s);
}
