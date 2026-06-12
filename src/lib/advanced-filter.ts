// Advanced search filter logic + export utilities (CSV, GEDCOM, print).
// UI lives in src/components/AdvancedSearch.tsx.
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
