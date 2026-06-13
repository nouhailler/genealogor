// Slim dismissible tip strip shown under the tab bar — one rotating tip per view,
// with shortcuts to the per-view guided demo and the contextual help panel.
import { useState } from 'react';
import type { TabId } from '@/types/genealogy';
import { TIPS } from '@/lib/tips';
import { Icon, renderInlineMd } from '@/components/ui-kit';

interface Props {
  tab: TabId;
  hidden: Record<string, boolean>;
  onHide: (tab: TabId) => void;
  onStartDemo: () => void;
  onOpenHelp: () => void;
}

export default function TipBar({ tab, hidden, onHide, onStartDemo, onOpenHelp }: Props) {
  // Rotation index per view, session-only — each visit may show a different tip.
  const [idxByTab, setIdxByTab] = useState<Record<string, number>>({});

  const tips = TIPS[tab] ?? [];
  if (hidden[tab] || tips.length === 0) return null;

  const idx = (idxByTab[tab] ?? 0) % tips.length;
  const next = () => setIdxByTab((prev) => ({ ...prev, [tab]: ((prev[tab] ?? 0) + 1) % tips.length }));

  const btn = 'h-11 sm:h-6 px-2.5 sm:px-1.5 inline-flex items-center gap-1 rounded text-[11px] font-mono shrink-0 transition-colors text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)]';

  return (
    <div className="flex items-start gap-2 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
      <Icon.Bulb className="size-3.5 shrink-0 mt-0.5" style={{ color: 'var(--warn)' }} />
      <button
        onClick={next}
        title="Astuce suivante"
        className="flex-1 min-w-0 text-left text-xs text-[var(--ink-muted)] leading-snug hover:text-[var(--ink)]"
      >
        {renderInlineMd(tips[idx])}
      </button>
      <span className="text-[10px] font-mono text-[var(--ink-faint)] shrink-0 mt-0.5 hidden sm:block">{idx + 1}/{tips.length}</span>
      <button onClick={next} className={btn} title="Astuce suivante">
        <Icon.ChevronRight className="size-3" />
      </button>
      <button onClick={onStartDemo} className={btn} title="Démo guidée de cette vue">
        <Icon.Play className="size-3" /> <span className="hidden sm:inline">Démo</span>
      </button>
      <button onClick={onOpenHelp} className={btn} title="Aide de cette vue (?)">
        <Icon.Help className="size-3.5" />
      </button>
      <button onClick={() => onHide(tab)} className={btn} title="Masquer les astuces pour cette vue">
        <Icon.X className="size-3.5" />
      </button>
    </div>
  );
}
