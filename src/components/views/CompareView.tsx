import { useState, useMemo } from 'react';
import type { Individual, Family } from '@/types/genealogy';
import { formatVital, Icon } from '@/components/ui-kit';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FieldDef {
  label: string;
  get: (p: Individual) => string | number | undefined;
}

// ── Main CompareView ──────────────────────────────────────────────────────────

interface Props {
  person: Individual;
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  onNavigate: (id: string) => void;
}

export default function CompareView({ person, individuals, families, onNavigate }: Props) {
  const [otherId, setOtherId] = useState<string | null>(null);
  const [picker, setPicker] = useState('');
  const other = otherId ? individuals.get(otherId) ?? null : null;

  const candidates = useMemo(() => {
    if (!picker.trim()) return [];
    const q = picker.toLowerCase();
    return Array.from(individuals.values())
      .filter((p) => p.id !== person.id && (p.name?.display || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [picker, individuals, person.id]);

  const FIELDS: FieldDef[] = [
    { label: 'Nom', get: (p) => p.name?.display },
    { label: 'Sexe', get: (p) => p.sex === 'M' ? 'Homme' : p.sex === 'F' ? 'Femme' : '—' },
    { label: 'Naissance', get: (p) => p.birth?.date?.display },
    { label: 'Lieu de naissance', get: (p) => p.birth?.place },
    { label: 'Décès', get: (p) => p.death?.date?.display },
    { label: 'Lieu de décès', get: (p) => p.death?.place },
    { label: 'Profession', get: (p) => p.occupation },
    { label: 'Note', get: (p) => p.note },
    { label: 'Nb mariages', get: (p) => (p.fams || []).length },
    {
      label: 'Nb enfants', get: (p) => {
        let n = 0;
        for (const fid of p.fams || []) {
          const f = families.get(fid);
          if (f) n += (f.children || []).length;
        }
        return n;
      },
    },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-4 border-b border-[var(--border)] shrink-0">
        <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1">Comparateur</div>
        <h2 className="text-[17px] sm:text-xl font-semibold text-[var(--ink)] tracking-tight">
          <span className="truncate">{person.name.display}</span>
          {other ? <span className="text-[var(--ink-faint)] font-normal"> vs {other.name.display}</span> : null}
        </h2>
      </div>

      {!other && (
        <div className="px-4 sm:px-6 py-5 border-b border-[var(--border)] shrink-0">
          <div className="relative max-w-md">
            <Icon.Search className="size-4 text-[var(--ink-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={picker} onChange={(e) => setPicker(e.target.value)}
              placeholder="Rechercher une personne…"
              className="w-full h-11 sm:h-10 pl-9 pr-3 rounded-md bg-[var(--surface)] border border-[var(--border)] text-base sm:text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]" />
          </div>
          {candidates.length > 0 && (
            <div className="mt-2 rounded-md border border-[var(--border)] divide-y divide-[var(--border)] max-w-md">
              {candidates.map((c) => (
                <button key={c.id} onClick={() => { setOtherId(c.id); setPicker(''); }}
                  className="w-full text-left px-3 py-3 sm:py-2 active:bg-[var(--surface-hover)] hover:bg-[var(--surface-hover)]">
                  <div className="text-sm text-[var(--ink)]">{c.name.display}</div>
                  <div className="text-[11px] font-mono text-[var(--ink-faint)]">{formatVital(c)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {other && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 mobile-pb-safe">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-[11px] font-mono text-[var(--ink-faint)]">
              <span className="hidden sm:inline">Champs identiques = vert · différents = orange</span>
              <span className="sm:hidden">
                <span className="inline-block size-2 rounded-full mr-1 align-middle" style={{ background: 'color-mix(in oklch, var(--warn) 60%, transparent)' }} />
                = différent
              </span>
            </div>
            <button onClick={() => setOtherId(null)} className="text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] underline-offset-2 hover:underline">
              Changer
            </button>
          </div>
          {/* Desktop: table */}
          <div className="hidden sm:block rounded-md border border-[var(--border)] overflow-hidden">
            <div className="grid grid-cols-[140px_1fr_1fr] divide-x divide-[var(--border)] border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">
              <div>Champ</div>
              <div>{person.name.display}</div>
              <div>{other.name.display}</div>
            </div>
            {FIELDS.map((f) => {
              const va = f.get(person);
              const vb = f.get(other);
              const same = String(va ?? '').toLowerCase() === String(vb ?? '').toLowerCase() && va != null;
              const bothEmpty = va == null && vb == null;
              return (
                <div key={f.label}
                  className="grid grid-cols-[140px_1fr_1fr] divide-x divide-[var(--border)] border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-hover)]"
                  style={{ background: same ? 'color-mix(in oklch, var(--success) 8%, transparent)' : bothEmpty ? undefined : (va != null && vb != null && !same) ? 'color-mix(in oklch, var(--warn) 6%, transparent)' : undefined }}>
                  <div className="px-3 py-2 text-[11px] font-mono text-[var(--ink-faint)]">{f.label}</div>
                  <div className="px-3 py-2 text-sm text-[var(--ink)] break-words">{va ?? <span className="text-[var(--ink-faint)] italic">—</span>}</div>
                  <div className="px-3 py-2 text-sm text-[var(--ink)] break-words">{vb ?? <span className="text-[var(--ink-faint)] italic">—</span>}</div>
                </div>
              );
            })}
          </div>

          {/* Mobile: stacked cards */}
          <div className="sm:hidden space-y-2">
            <div className="grid grid-cols-2 gap-2 sticky top-0 z-10 bg-[var(--bg)] pb-2">
              <div className="px-2 py-1.5 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[11px] font-mono text-[var(--ink-muted)] truncate">{person.name.display}</div>
              <div className="px-2 py-1.5 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[11px] font-mono text-[var(--ink-muted)] truncate">{other.name.display}</div>
            </div>
            {FIELDS.map((f) => {
              const va = f.get(person);
              const vb = f.get(other);
              const same = String(va ?? '').toLowerCase() === String(vb ?? '').toLowerCase() && va != null;
              const bothEmpty = va == null && vb == null;
              const bg = same
                ? 'color-mix(in oklch, var(--success) 8%, transparent)'
                : bothEmpty ? 'var(--surface)' : (va != null && vb != null && !same) ? 'color-mix(in oklch, var(--warn) 6%, transparent)' : 'var(--surface)';
              return (
                <div key={f.label} className="rounded-md border border-[var(--border)] overflow-hidden" style={{ background: bg }}>
                  <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--ink-faint)] border-b border-[var(--border)]">{f.label}</div>
                  <div className="grid grid-cols-2 divide-x divide-[var(--border)]">
                    <div className="px-3 py-2 text-[13px] text-[var(--ink)] break-words">{va ?? <span className="text-[var(--ink-faint)] italic">—</span>}</div>
                    <div className="px-3 py-2 text-[13px] text-[var(--ink)] break-words">{vb ?? <span className="text-[var(--ink-faint)] italic">—</span>}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 text-[11px] font-mono text-[var(--ink-faint)]">
            Cliquez sur un profil pour l'ouvrir :{' '}
            <button onClick={() => onNavigate(person.id)} className="text-[var(--accent)] hover:underline">{person.name.display}</button>
            {' · '}
            <button onClick={() => onNavigate(other.id)} className="text-[var(--accent)] hover:underline">{other.name.display}</button>
          </div>
        </div>
      )}
    </div>
  );
}
