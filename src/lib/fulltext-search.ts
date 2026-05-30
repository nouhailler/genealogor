import MiniSearch from 'minisearch';
import type { Individual } from '@/types/genealogy';

interface SearchResult {
  person: Individual;
  score: number;
  matches: Record<string, string[]>;
  terms: string[];
}

let index: MiniSearch | null = null;
let lastSig: string | null = null;

function buildIndex(individuals: Map<string, Individual>): MiniSearch {
  const sig = individuals.size + '-' + (Array.from(individuals.keys())[0] || '');
  if (lastSig === sig && index) return index;

  const ms = new MiniSearch({
    idField: 'id',
    fields: ['fullName', 'given', 'surname', 'birthPlace', 'deathPlace', 'occupation', 'note'],
    storeFields: ['fullName', 'vital', 'birthPlace', 'occupation'],
    searchOptions: {
      boost: { surname: 3, given: 2, fullName: 2 },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  const docs = Array.from(individuals.values()).map((p) => ({
    id: p.id,
    fullName: p.name?.display || '',
    given: p.name?.given || '',
    surname: p.name?.surname || '',
    birthPlace: p.birth?.place || '',
    deathPlace: p.death?.place || '',
    occupation: p.occupation || '',
    note: p.note || '',
    vital:
      (p.birth?.date?.year || '') +
      (p.death?.date?.year ? '–' + p.death.date.year : ''),
  }));

  ms.addAll(docs);
  index = ms;
  lastSig = sig;
  return ms;
}

export function search(query: string, individuals: Map<string, Individual>, limit = 50): SearchResult[] {
  const ms = buildIndex(individuals);
  if (!query.trim()) return [];
  const results = ms.search(query, { combineWith: 'AND' });
  return results
    .slice(0, limit)
    .map((r) => ({
      person: individuals.get(r.id)!,
      score: r.score,
      matches: r.match,
      terms: r.terms,
    }))
    .filter((r) => r.person);
}

export function invalidateIndex() {
  index = null;
  lastSig = null;
}

export const FullTextSearch = { buildIndex, search, invalidateIndex };
