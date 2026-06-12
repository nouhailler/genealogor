// Mobile tab configuration — shared by MobileShell and App.
import type { TabId } from '@/types/genealogy';

/** Tabs shown directly in the bottom nav. 'liste' is not a TabId — it opens the list pane. */
export const PRIMARY_MOBILE_TABS = ['liste', 'profile', 'ancestors', 'descendants'] as const;
export type PrimaryMobileTab = (typeof PRIMARY_MOBILE_TABS)[number];

/** All other tabs live in the "Plus" sheet. */
export const OVERFLOW_TABS: TabId[] = [
  'implex', 'compare', 'graph', 'timeline', 'places', 'map', 'media', 'stats', 'validation', 'ai',
];
