import type { Individual, Family } from '@/types/genealogy';

export function computeAboville(
  rootPerson: Individual,
  individuals: Map<string, Individual>,
  families: Map<string, Family>,
  maxGen = 10,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!rootPerson) return map;
  map.set(rootPerson.id, '1');

  function visit(personId: string, prefix: string, gen: number) {
    if (gen > maxGen) return;
    const person = individuals.get(personId);
    if (!person) return;

    const allChildren: string[] = [];
    for (const fid of person.fams || []) {
      const fam = families.get(fid);
      if (!fam) continue;
      for (const cid of fam.children || []) {
        if (!allChildren.includes(cid)) allChildren.push(cid);
      }
    }

    allChildren.sort((a, b) => {
      const pa = individuals.get(a)?.birth?.date?.year ?? 9999;
      const pb = individuals.get(b)?.birth?.date?.year ?? 9999;
      return pa - pb;
    });

    allChildren.forEach((cid, idx) => {
      const code = `${prefix}.${idx + 1}`;
      if (!map.has(cid)) {
        map.set(cid, code);
        visit(cid, code, gen + 1);
      }
    });
  }

  visit(rootPerson.id, '1', 0);
  return map;
}

export function findDeadBranches(
  individuals: Map<string, Individual>,
  families: Map<string, Family>,
): Individual[] {
  const hasChildren = new Set<string>();
  for (const fam of families.values()) {
    if (fam.children && fam.children.length > 0) {
      if (fam.husband) hasChildren.add(fam.husband);
      if (fam.wife) hasChildren.add(fam.wife);
    }
  }
  return Array.from(individuals.values()).filter((p) => !hasChildren.has(p.id));
}

interface CohortEntry {
  decade: number;
  avgAll: number | null;
  avgM: number | null;
  avgF: number | null;
  countAll: number;
  countM: number;
  countF: number;
}

export function computeCohortLifeExpectancy(individuals: Map<string, Individual>): CohortEntry[] {
  const cohorts = new Map<number, { M: number[]; F: number[]; all: number[] }>();
  for (const p of individuals.values()) {
    const by = p.birth?.date?.year;
    const dy = p.death?.date?.year;
    if (!by || !dy) continue;
    const span = dy - by;
    if (span < 0 || span > 120) continue;
    const decade = Math.floor(by / 10) * 10;
    if (!cohorts.has(decade)) cohorts.set(decade, { M: [], F: [], all: [] });
    const c = cohorts.get(decade)!;
    c.all.push(span);
    if (p.sex === 'M') c.M.push(span);
    else if (p.sex === 'F') c.F.push(span);
  }
  const avg = (arr: number[]) =>
    arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length;
  const result: CohortEntry[] = [];
  for (const [decade, c] of cohorts) {
    result.push({
      decade,
      avgAll: avg(c.all),
      avgM: avg(c.M),
      avgF: avg(c.F),
      countAll: c.all.length,
      countM: c.M.length,
      countF: c.F.length,
    });
  }
  return result.sort((a, b) => a.decade - b.decade);
}

export const Descendance = { computeAboville, findDeadBranches, computeCohortLifeExpectancy };
