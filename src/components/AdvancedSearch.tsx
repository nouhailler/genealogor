// Advanced search panel — filter logic lives in @/lib/advanced-filter.
import { useState } from 'react';
import { EMPTY_FILTER, isFilterActive, type SearchFilter } from '@/lib/advanced-filter';

// ── AdvancedSearch component ──────────────────────────────────────────────────

interface Props {
  value: SearchFilter;
  onChange: (v: SearchFilter) => void;
}

export default function AdvancedSearch({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const active = isFilterActive(value);
  const activeCount = [value.surname, value.given, value.place, value.yearMin, value.yearMax, value.sex, value.text].filter(Boolean).length;

  const update = (patch: Partial<SearchFilter>) => onChange({ ...value, ...patch });
  const reset  = () => onChange(EMPTY_FILTER);

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`mt-2 w-full flex items-center justify-between px-3 py-1.5 rounded-md border text-xs transition-colors ${
          active
            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
            : 'border-[var(--border)] text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]'
        }`}
      >
        <span className="font-medium flex items-center gap-2">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filtres avancés
          {active && (
            <span className="size-5 grid place-items-center rounded-full text-[10px] font-mono font-semibold"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
              {activeCount}
            </span>
          )}
        </span>
        <svg viewBox="0 0 24 24" className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Inline panel */}
      {open && (
        <div className="mt-2 p-3 rounded-md border border-[var(--border)] bg-[var(--surface)] space-y-2.5">
          <FilterField label="Patronyme">
            <FilterInput value={value.surname} onChange={(v) => update({ surname: v })} placeholder="Lefevre" />
          </FilterField>
          <FilterField label="Prénom">
            <FilterInput value={value.given} onChange={(v) => update({ given: v })} placeholder="Henri" />
          </FilterField>
          <FilterField label="Lieu (contient)">
            <FilterInput value={value.place} onChange={(v) => update({ place: v })} placeholder="Paris" />
          </FilterField>
          <FilterField label="Période de naissance">
            <div className="flex items-center gap-2">
              <FilterInput value={value.yearMin} onChange={(v) => update({ yearMin: v.replace(/\D/g, '').slice(0, 4) })} placeholder="1800" />
              <span className="text-[var(--ink-faint)]">→</span>
              <FilterInput value={value.yearMax} onChange={(v) => update({ yearMax: v.replace(/\D/g, '').slice(0, 4) })} placeholder="1900" />
            </div>
          </FilterField>
          <FilterField label="Sexe">
            <div className="flex gap-1">
              {([['', 'Tous'], ['M', 'Hommes'], ['F', 'Femmes']] as const).map(([k, l]) => (
                <button key={k} onClick={() => update({ sex: k as SearchFilter['sex'] })}
                  className={`flex-1 px-2 py-1 text-xs rounded border ${
                    value.sex === k
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]'
                  }`}>
                  {l}
                </button>
              ))}
            </div>
          </FilterField>
          <FilterField label="Recherche libre (notes, profession, lieux)">
            <FilterInput value={value.text} onChange={(v) => update({ text: v })} placeholder="médecin, Lyon…" />
          </FilterField>
          {active && (
            <button onClick={reset} className="w-full text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] py-1">
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1">{label}</div>
      {children}
    </div>
  );
}
function FilterInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full h-8 px-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)]" />
  );
}
