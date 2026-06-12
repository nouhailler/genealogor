// First-launch onboarding state (localStorage-backed).
import { useState } from 'react';

const ONBOARD_KEY = 'genealogor.onboarded';

/** Returns [shouldShowOnboarding, dismiss]. */
export function useOnboarding(): [boolean, () => void] {
  const [show, setShow] = useState(() => {
    try { return localStorage.getItem(ONBOARD_KEY) !== '1'; } catch { return false; }
  });
  return [show, () => setShow(false)];
}

/** Persist that the onboarding flow was completed. */
export function markOnboarded(): void {
  try { localStorage.setItem(ONBOARD_KEY, '1'); } catch { /* ignore */ }
}
