// Advanced search panel + export utilities (CSV, GEDCOM, print).
import { useState } from 'react';
import { download as downloadGEDCOM } from '@/lib/gedcom-serializer';
import type { Individual, Family } from '@/types/genealogy';

// ── Filter type ───────────────────────────────────────────────────────────────

export interface SearchFilter {
  surname: string;
  given:   string;
  place:   string;
  yearMin: string;
  yearMax: string;
  sex:     '' | 'M' | 'F';
  text:    string;
}

export const EMPTY_FILTER: SearchFilter = {
  surname: '', given: '', place: '', yearMin: '', yearMax: '', sex: '', text: '',
};

export function isFilterActive(f: SearchFilter): boolean {
  return !!(f.surname || f.given || f.place || f.yearMin || f.yearMax || f.sex || f.text);
}

// ── Filter logic ──────────────────────────────────────────────────────────────

function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function applyAdvancedFilter(
  people: Individual[],
  query: string,
  filter: SearchFilter,
): Individual[] {
  const qq   = norm(query.trim());
  const yMin = filter.yearMin ? parseInt(filter.yearMin, 10) : null;
  const yMax = filter.yearMax ? parseInt(filter.yearMax, 10) : null;

  return people.filter((p) => {
    if (qq && !norm(`${p.name.display} ${p.name.given} ${p.name.surname}`).includes(qq)) return false;
    if (filter.surname && !norm(p.name.surname).includes(norm(filter.surname))) return false;
    if (filter.given   && !norm(p.name.given).includes(norm(filter.given)))     return false;
    if (filter.sex     && p.sex !== filter.sex) return false;
    if (filter.place) {
      const places = `${p.birth?.place || ''} ${p.death?.place || ''}`;
      if (!norm(places).includes(norm(filter.place))) return false;
    }
    const by = p.birth?.date?.year;
    if (yMin !== null && (!by || by < yMin)) return false;
    if (yMax !== null && (!by || by > yMax)) return false;
    if (filter.text) {
      const hay = norm(`${p.note || ''} ${p.occupation || ''} ${p.birth?.place || ''} ${p.death?.place || ''}`);
      if (!hay.includes(norm(filter.text))) return false;
    }
    return true;
  });
}

// ── Export utilities ──────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function exportCSV(individuals: Map<string, Individual>): void {
  const headers = ['ID', 'Prénom', 'Patronyme', 'Sexe', 'Naissance', 'Lieu naissance', 'Décès', 'Lieu décès', 'Profession'];
  const rows    = [headers.join(',')];
  for (const p of individuals.values()) {
    const cells = [
      p.id, p.name.given, p.name.surname, p.sex,
      p.birth?.date?.display || '', p.birth?.place || '',
      p.death?.date?.display || '', p.death?.place || '',
      p.occupation || '',
    ].map((c) => {
      const s = String(c || '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    });
    rows.push(cells.join(','));
  }
  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `genealogie-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportGEDCOM(
  individuals: Map<string, Individual>,
  families: Map<string, Family>,
): void {
  downloadGEDCOM(individuals, families);
}

export function printPage(): void {
  window.print();
}

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
