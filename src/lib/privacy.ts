import { useState, useEffect } from 'react';
import type { Individual } from '@/types/genealogy';

const STORAGE_KEY = 'genealogor.privacy';

export interface PrivacyState {
  enabled: boolean;
  threshold: number;
}

function defaultState(): PrivacyState {
  return { enabled: false, threshold: new Date().getFullYear() - 100 };
}

export function loadPrivacy(): PrivacyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const dflt = defaultState();
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : dflt.enabled,
      threshold: typeof parsed.threshold === 'number' ? parsed.threshold : dflt.threshold,
    };
  } catch { return defaultState(); }
}

export function savePrivacy(s: PrivacyState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  window.dispatchEvent(new Event('genealogor-privacy-changed'));
}

export function shouldMask(person: Individual | null | undefined, state?: PrivacyState): boolean {
  const st = state ?? loadPrivacy();
  if (!st.enabled || !person) return false;
  if (person.death?.date?.year) return false;
  const by = person.birth?.date?.year;
  if (by == null) return true;
  return by >= st.threshold;
}

export function privacySummary(individuals: Map<string, Individual>): { masked: number; total: number } {
  if (!individuals) return { masked: 0, total: 0 };
  const state = loadPrivacy();
  if (!state.enabled) return { masked: 0, total: individuals.size };
  let masked = 0;
  for (const p of individuals.values()) {
    if (shouldMask(p, state)) masked++;
  }
  return { masked, total: individuals.size };
}

export function usePrivacy(): [PrivacyState, (patch: Partial<PrivacyState> | ((s: PrivacyState) => PrivacyState)) => void] {
  const [s, set] = useState<PrivacyState>(loadPrivacy);

  useEffect(() => {
    const cb = () => set(loadPrivacy());
    window.addEventListener('genealogor-privacy-changed', cb);
    window.addEventListener('storage', cb);
    return () => {
      window.removeEventListener('genealogor-privacy-changed', cb);
      window.removeEventListener('storage', cb);
    };
  }, []);

  const update = (patch: Partial<PrivacyState> | ((s: PrivacyState) => PrivacyState)) => {
    const next = { ...loadPrivacy(), ...(typeof patch === 'function' ? patch(s) : patch) };
    savePrivacy(next);
  };

  return [s, update];
}

export const Privacy = { load: loadPrivacy, save: savePrivacy, shouldMask, summary: privacySummary, defaultState };
