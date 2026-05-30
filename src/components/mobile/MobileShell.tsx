// Mobile bottom navigation + "Plus" overflow sheet.
// Activated automatically at < 768px.
import type { TabId } from '@/types/genealogy';
import type { Individual } from '@/types/genealogy';
import { formatVital } from '@/components/ui-kit';

// ── Tab configuration ─────────────────────────────────────────────────────────

/** Tabs shown directly in the bottom nav. 'liste' is not a TabId — it opens the list pane. */
export const PRIMARY_MOBILE_TABS = ['liste', 'profile', 'ancestors', 'descendants'] as const;
export type PrimaryMobileTab = (typeof PRIMARY_MOBILE_TABS)[number];

/** All other tabs live in the "Plus" sheet. */
export const OVERFLOW_TABS: TabId[] = [
  'implex', 'compare', 'graph', 'timeline', 'places', 'map', 'media', 'stats', 'validation', 'ai',
];

const TAB_LABELS: Record<string, string> = {
  liste: 'Liste', profile: 'Profil', ancestors: 'Ascend.', descendants: 'Descend.',
  implex: 'Implications', compare: 'Comparer', graph: 'Graphe', timeline: 'Frise',
  places: 'Lieux', map: 'Carte', media: 'Médias', stats: 'Statistiques',
  validation: 'Qualité', ai: 'IA',
};

const S = (d: string) => ({ viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none' as const, stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, dangerouslySetInnerHTML: { __html: d } });

const ICONS: Record<string, React.ReactElement> = {
  liste:       <svg {...S('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>')} />,
  profile:     <svg {...S('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>')} />,
  ancestors:   <svg {...S('<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>')} />,
  descendants: <svg {...S('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>')} />,
  implex:      <svg {...S('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>')} />,
  compare:     <svg {...S('<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/>')} />,
  graph:       <svg {...S('<circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><line x1="6.5" y1="7.5" x2="10.5" y2="16.5"/><line x1="17.5" y1="7.5" x2="13.5" y2="16.5"/><line x1="7" y1="6" x2="17" y2="6"/>')} />,
  timeline:    <svg {...S('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>')} />,
  places:      <svg {...S('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>')} />,
  map:         <svg {...S('<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>')} />,
  media:       <svg {...S('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>')} />,
  stats:       <svg {...S('<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>')} />,
  validation:  <svg {...S('<path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.39 0 4.68.94 6.36 2.64"/>')} />,
  ai:          <svg {...S('<path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/>')} />,
};

const MORE_ICON = <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
  <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
</svg>;

// ── MobileBottomNav ───────────────────────────────────────────────────────────

interface BottomNavProps {
  mobilePane: 'list' | 'profile';
  activeTab: TabId;
  onPickPrimary: (id: PrimaryMobileTab) => void;
  onOpenMore: () => void;
}

export function MobileBottomNav({ mobilePane, activeTab, onPickPrimary, onOpenMore }: BottomNavProps) {
  const currentKey = mobilePane === 'list' ? 'liste' : activeTab;
  const isOverflow = mobilePane !== 'list' && (OVERFLOW_TABS as string[]).includes(activeTab);

  return (
    <nav style={{
      display: 'flex', justifyContent: 'space-around', flexShrink: 0,
      background: 'var(--bg)', borderTop: '1px solid var(--border)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {PRIMARY_MOBILE_TABS.map((id) => {
        const active = currentKey === id && !isOverflow;
        return (
          <button
            key={id}
            onClick={() => onPickPrimary(id)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 64, padding: '8px 2px 10px', color: active ? 'var(--ink)' : 'var(--ink-faint)' }}
            className="active:opacity-70"
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 32, borderRadius: 16, background: active ? 'var(--accent-soft)' : 'transparent', color: active ? 'var(--accent)' : 'currentColor', transition: 'background 0.15s' }}>
              {ICONS[id]}
            </span>
            <span style={{ fontSize: 11, fontWeight: active ? 600 : 500 }}>{TAB_LABELS[id]}</span>
          </button>
        );
      })}
      <button
        onClick={onOpenMore}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 64, padding: '8px 2px 10px', color: isOverflow ? 'var(--ink)' : 'var(--ink-faint)' }}
        className="active:opacity-70"
      >
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 32, borderRadius: 16, background: isOverflow ? 'var(--accent-soft)' : 'transparent', color: isOverflow ? 'var(--accent)' : 'currentColor' }}>
          {MORE_ICON}
        </span>
        <span style={{ fontSize: 11, fontWeight: isOverflow ? 600 : 500 }}>
          {isOverflow ? TAB_LABELS[activeTab] : 'Plus'}
        </span>
      </button>
    </nav>
  );
}

// ── MobileMoreSheet ───────────────────────────────────────────────────────────

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  activeTab: TabId;
  onPickTab: (tab: TabId) => void;
  theme: 'light' | 'dark';
  onTheme: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onReset: () => void;
  onAddFiles: () => void;
  favoritePersons?: Individual[];
  recentPersons?: Individual[];
  onSelectPerson?: (id: string) => void;
}

export function MobileMoreSheet({
  open, onClose, activeTab, onPickTab, theme, onTheme,
  onOpenSettings, onOpenHelp, onReset, onAddFiles,
  favoritePersons, recentPersons, onSelectPerson,
}: MoreSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-h-[85vh] overflow-y-auto"
        style={{ background: 'var(--bg)', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 'max(16px, env(safe-area-inset-bottom))', animation: 'sheetUp 0.25s ease-out' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)' }} />
        </div>

        {/* Favorites */}
        {(favoritePersons?.length || recentPersons?.length) ? (
          <div className="px-4 pt-3">
            {(favoritePersons?.length ?? 0) > 0 && (
              <div className="mb-4">
                <div className="text-[11.5px] font-medium uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--ink-faint)' }}>★ Favoris ({favoritePersons!.length})</div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
                  {favoritePersons!.slice(0, 12).map((p) => (
                    <PersonChip key={p.id} person={p} onClick={() => { onSelectPerson?.(p.id); onClose(); }} />
                  ))}
                </div>
              </div>
            )}
            {(recentPersons?.length ?? 0) > 0 && (
              <div className="mb-4">
                <div className="text-[11.5px] font-medium uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--ink-faint)' }}>Récemment consultés</div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
                  {recentPersons!.slice(0, 12).map((p) => (
                    <PersonChip key={p.id} person={p} onClick={() => { onSelectPerson?.(p.id); onClose(); }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Overflow tab grid */}
        <div className="px-4 pt-2">
          <div className="text-[11.5px] font-medium uppercase tracking-wider mb-2.5 px-1" style={{ color: 'var(--ink-faint)' }}>Vues</div>
          <div className="grid grid-cols-4 gap-2">
            {OVERFLOW_TABS.map((id) => (
              <button
                key={id}
                onClick={() => { onPickTab(id); onClose(); }}
                className="flex flex-col items-center justify-center gap-1.5 active:opacity-70"
                style={{
                  padding: '12px 4px', borderRadius: 16, minHeight: 80,
                  background: activeTab === id ? 'var(--accent-soft)' : 'var(--surface)',
                  color: activeTab === id ? 'var(--accent)' : 'var(--ink)',
                  border: '1px solid var(--border)',
                }}
              >
                {ICONS[id]}
                <span style={{ fontSize: 11.5, fontWeight: 500, lineHeight: 1.2, textAlign: 'center' }}>{TAB_LABELS[id]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 pt-5">
          <div className="text-[11.5px] font-medium uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--ink-faint)' }}>Actions</div>
          <div className="flex flex-col">
            <SheetAction icon={ICONS.media} label="Ajouter un fichier GEDCOM" onClick={() => { onAddFiles(); onClose(); }} />
            <SheetAction
              icon={theme === 'light' ? ICONS.map : ICONS.places}
              label={theme === 'light' ? 'Mode sombre' : 'Mode clair'}
              onClick={onTheme}
            />
            <SheetAction icon={ICONS.ai} label="Paramètres IA" onClick={() => { onOpenSettings(); onClose(); }} />
            <SheetAction icon={ICONS.validation} label="Aide" onClick={() => { onOpenHelp(); onClose(); }} />
            <SheetAction icon={ICONS.stats} label="Recommencer (charger un autre fichier)" onClick={() => { onReset(); onClose(); }} danger />
          </div>
        </div>

        <div className="px-4 pt-3 pb-2 text-center text-[10.5px]" style={{ color: 'var(--ink-faint)' }}>
          Genealogor · données 100% locales
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SheetAction({ icon, label, onClick, danger }: {
  icon: React.ReactElement;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button onClick={onClick} className="flex items-center gap-4 px-2 py-3.5 rounded-xl text-left active:opacity-70"
      style={{ color: danger ? 'var(--danger)' : 'var(--ink)' }}>
      <span className="shrink-0" style={{ color: danger ? 'var(--danger)' : 'var(--ink-muted)' }}>{icon}</span>
      <span style={{ fontSize: 15, fontWeight: 500 }}>{label}</span>
    </button>
  );
}

function PersonChip({ person, onClick }: { person: Individual; onClick: () => void }) {
  const sexAccent = person.sex === 'F' ? 'var(--sex-f)' : person.sex === 'M' ? 'var(--sex-m)' : 'var(--ink-faint)';
  return (
    <button onClick={onClick} className="shrink-0 text-left rounded-xl px-3 py-2.5 active:opacity-70"
      style={{ scrollSnapAlign: 'start', background: 'var(--surface)', border: '1px solid var(--border)', minWidth: 140, maxWidth: 200 }}>
      <div className="flex items-center gap-2 mb-0.5">
        <span className="size-1.5 rounded-full shrink-0" style={{ background: sexAccent }} />
        <span className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>{person.name.given || '?'}</span>
      </div>
      <div className="text-[11.5px] font-semibold uppercase tracking-tight truncate" style={{ color: 'var(--ink)' }}>
        {person.name.surname || '?'}
      </div>
      <div className="text-[10.5px] font-mono mt-0.5" style={{ color: 'var(--ink-faint)' }}>{formatVital(person)}</div>
    </button>
  );
}
