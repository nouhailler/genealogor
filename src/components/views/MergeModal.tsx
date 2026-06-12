// Assisted duplicate-merge modal.
import { useState } from 'react';
import { markResolved } from '@/lib/merge-resolved';
import { Icon } from '@/components/ui-kit';
import type { Individual, Family } from '@/types/genealogy';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DuplicatePair {
  a: Individual;
  b: Individual;
  score: number;
}

interface MergeField {
  key: string;
  label: string;
  get: (p: Individual) => string | number | null | undefined;
}

const MERGE_FIELDS: MergeField[] = [
  { key: 'name.display',      label: 'Nom complet',       get: (p) => p.name?.display },
  { key: 'sex',               label: 'Sexe',              get: (p) => p.sex },
  { key: 'birth.date.display',label: 'Date de naissance', get: (p) => p.birth?.date?.display },
  { key: 'birth.place',       label: 'Lieu de naissance', get: (p) => p.birth?.place },
  { key: 'death.date.display',label: 'Date de décès',     get: (p) => p.death?.date?.display },
  { key: 'death.place',       label: 'Lieu de décès',     get: (p) => p.death?.place },
  { key: 'occupation',        label: 'Profession',        get: (p) => p.occupation },
  { key: 'note',              label: 'Note',              get: (p) => p.note },
];

interface Props {
  pair: DuplicatePair;
  families: Map<string, Family>;
  onClose: (changed: boolean) => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MergeModal({ pair, families, onClose }: Props) {
  const { a, b } = pair;

  const [choices, setChoices] = useState<Record<string, 'a' | 'b'>>(() => {
    const c: Record<string, 'a' | 'b'> = {};
    for (const f of MERGE_FIELDS) {
      const va = f.get(a);
      c[f.key] = va ? 'a' : f.get(b) ? 'b' : 'a';
    }
    return c;
  });

  const [keepId, setKeepId] = useState<string>(() => {
    const score = (p: Individual) => MERGE_FIELDS.filter((f) => f.get(p)).length;
    return score(a) >= score(b) ? a.id : b.id;
  });

  const stats = (p: Individual) => {
    let kids = 0, marriages = 0;
    for (const fid of p.fams || []) {
      const f = families.get(fid);
      if (!f) continue;
      marriages++;
      kids += (f.children || []).length;
    }
    return { kids, marriages };
  };
  const sa = stats(a), sb = stats(b);

  const exportPlan = () => {
    const merged: Record<string, ReturnType<MergeField['get']>> = {};
    for (const f of MERGE_FIELDS) {
      merged[f.key] = f.get(choices[f.key] === 'a' ? a : b);
    }
    const plan = {
      keep: keepId,
      remove: keepId === a.id ? b.id : a.id,
      mergedFields: merged,
      sourceA: a.id,
      sourceB: b.id,
      generatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url;
    el.download = `merge-${a.id.replace(/[@:]/g, '')}-${b.id.replace(/[@:]/g, '')}.json`;
    el.click();
    URL.revokeObjectURL(url);
  };

  const resolve = () => {
    markResolved(a.id, b.id);
    onClose(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4 sm:p-8" onClick={() => onClose(false)}>
      <div
        className="bg-[var(--bg)] rounded-lg border border-[var(--border)] shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon.GitMerge className="size-4 text-[var(--accent)]" />
            <h3 className="text-sm font-medium text-[var(--ink)]">Fusion assistée</h3>
            <span className="text-[10px] font-mono text-[var(--ink-faint)] px-1.5 py-0.5 rounded bg-[var(--surface)]">
              Score {pair.score}/100
            </span>
          </div>
          <button onClick={() => onClose(false)} className="size-7 grid place-items-center rounded text-[var(--ink-faint)] hover:bg-[var(--surface-hover)]">
            <Icon.X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-xs text-[var(--ink-muted)] mb-4 leading-relaxed">
            Comparez les deux fiches, choisissez quelle valeur garder pour chaque champ, puis désignez la fiche à conserver.
            La fusion produit un plan JSON exportable et marque la paire comme résolue.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <PersonCol p={a} side="a" st={sa} keepId={keepId} choices={choices} onKeep={setKeepId} onChoose={setChoices} />
            <PersonCol p={b} side="b" st={sb} keepId={keepId} choices={choices} onKeep={setKeepId} onChoose={setChoices} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
          <button onClick={() => onClose(false)} className="text-xs font-mono text-[var(--ink-muted)] hover:text-[var(--ink)] px-3 py-2">
            Annuler
          </button>
          <div className="flex gap-2">
            <button onClick={exportPlan} className="text-xs font-mono px-3 py-2 rounded border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--surface-hover)]">
              Exporter le plan JSON
            </button>
            <button onClick={resolve} className="text-xs font-mono px-3 py-2 rounded bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90">
              Marquer comme résolu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

interface PersonColProps {
  p: Individual;
  side: 'a' | 'b';
  st: { kids: number; marriages: number };
  keepId: string;
  choices: Record<string, 'a' | 'b'>;
  onKeep: (id: string) => void;
  onChoose: React.Dispatch<React.SetStateAction<Record<string, 'a' | 'b'>>>;
}

function PersonCol({ p, side, st, keepId, choices, onKeep, onChoose }: PersonColProps) {
  const isKept = keepId === p.id;
  return (
    <div className={`rounded-md border-2 transition-colors ${isKept ? 'border-[var(--accent)]' : 'border-[var(--border)]'} bg-[var(--surface)]`}>
      <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-xs font-mono text-[var(--ink-faint)] truncate">{p.id}</div>
          <div className="text-sm font-medium text-[var(--ink)] truncate">{p.name.display}</div>
        </div>
        <button
          onClick={() => onKeep(p.id)}
          className={`shrink-0 text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded ${
            isKept ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'bg-[var(--bg)] text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]'
          }`}
        >
          {isKept ? '✓ Conservé' : 'Conserver'}
        </button>
      </div>
      <div className="px-3 py-2 grid grid-cols-2 gap-2 text-[11px] font-mono text-[var(--ink-muted)] border-b border-[var(--border)]">
        <div>Mariages : <span className="text-[var(--ink)] tabular-nums">{st.marriages}</span></div>
        <div>Enfants : <span className="text-[var(--ink)] tabular-nums">{st.kids}</span></div>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {MERGE_FIELDS.map((f) => {
          const v = f.get(p);
          const selected = choices[f.key] === side;
          return (
            <button
              key={f.key}
              onClick={() => onChoose((c) => ({ ...c, [f.key]: side }))}
              disabled={!v}
              className={`w-full text-left px-3 py-2 transition-colors ${
                selected ? 'bg-[color:var(--accent)]/10' : v ? 'hover:bg-[var(--surface-hover)]' : 'opacity-50'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className={`size-3.5 mt-0.5 rounded-full border-2 shrink-0 ${selected ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border)]'}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">{f.label}</div>
                  <div className="text-sm text-[var(--ink)] break-words">{v || <span className="text-[var(--ink-faint)] italic">—</span>}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
