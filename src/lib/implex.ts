import type { Individual, Family } from '@/types/genealogy';

export interface ImplexEntry {
  sosaNumbers: number[];
  generations: number[];
  person: Individual;
}

export interface GenerationStat {
  generation: number;
  theoretical: number;
  present: number;
  distinct: number;
  completeness: number;
  endogamyRate: number;
}

export interface ImplexResult {
  occurrences: Map<string, ImplexEntry>;
  implexEntries: ImplexEntry[];
  generationStats: GenerationStat[];
  globalEndogamy: number;
  totalAncestorSlots: number;
  distinctAncestors: number;
  sosaToId: Map<number, string>;
}

export function compute(
  rootPerson: Individual,
  individuals: Map<string, Individual>,
  families: Map<string, Family>,
  maxGen = 12,
): ImplexResult {
  const occurrences = new Map<string, ImplexEntry>();
  const sosaToId = new Map<number, string>();

  function visit(personId: string, sosa: number, gen: number) {
    if (!personId || gen > maxGen) return;
    const person = individuals.get(personId);
    if (!person) return;

    sosaToId.set(sosa, personId);
    if (!occurrences.has(personId)) {
      occurrences.set(personId, { sosaNumbers: [], generations: [], person });
    }
    const entry = occurrences.get(personId)!;
    entry.sosaNumbers.push(sosa);
    entry.generations.push(gen);

    const famc = person.famc?.[0];
    if (!famc) return;
    const fam = families.get(famc);
    if (!fam) return;

    if (fam.husband) visit(fam.husband, sosa * 2, gen + 1);
    if (fam.wife) visit(fam.wife, sosa * 2 + 1, gen + 1);
  }

  visit(rootPerson.id, 1, 0);

  const implexEntries = Array.from(occurrences.values())
    .filter((e) => e.sosaNumbers.length > 1)
    .sort((a, b) => b.sosaNumbers.length - a.sosaNumbers.length);

  const perGen = new Map<number, { distinct: Set<string>; total: number }>();
  for (const [sosa, id] of sosaToId) {
    const gen = Math.floor(Math.log2(sosa));
    if (!perGen.has(gen)) perGen.set(gen, { distinct: new Set(), total: 0 });
    const g = perGen.get(gen)!;
    g.distinct.add(id);
    g.total++;
  }

  const generationStats: GenerationStat[] = [];
  for (let g = 0; g <= maxGen; g++) {
    const data = perGen.get(g);
    const theoretical = Math.pow(2, g);
    const present = data ? data.total : 0;
    const distinct = data ? data.distinct.size : 0;
    generationStats.push({
      generation: g,
      theoretical,
      present,
      distinct,
      completeness: theoretical > 0 ? (present / theoretical) * 100 : 0,
      endogamyRate: present > 0 ? ((present - distinct) / present) * 100 : 0,
    });
  }

  let totalSlots = 0;
  const distinctTotal = new Set<string>();
  for (const [, id] of sosaToId) {
    totalSlots++;
    distinctTotal.add(id);
  }
  const globalEndogamy =
    totalSlots > 0 ? ((totalSlots - distinctTotal.size) / totalSlots) * 100 : 0;

  return {
    occurrences,
    implexEntries,
    generationStats,
    globalEndogamy,
    totalAncestorSlots: totalSlots,
    distinctAncestors: distinctTotal.size,
    sosaToId,
  };
}

export function isImplexedFor(personId: string, implexData: ImplexResult | null): boolean {
  const e = implexData?.occurrences?.get(personId);
  return !!(e && e.sosaNumbers.length > 1);
}

export const Implex = { compute, isImplexedFor };
