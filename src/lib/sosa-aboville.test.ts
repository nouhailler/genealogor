import { describe, it, expect } from 'vitest';
import { compute, isImplexedFor } from '@/lib/implex';
import { computeAboville, findDeadBranches, computeCohortLifeExpectancy } from '@/lib/descendance';
import type { Individual, Family } from '@/types/genealogy';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function mkPerson(
  id: string,
  opts: {
    sex?: 'M' | 'F' | 'U';
    famc?: string[];
    fams?: string[];
    birthYear?: number;
    deathYear?: number;
  } = {},
): Individual {
  return {
    id,
    name: { given: id, surname: 'Test', display: `${id} Test` },
    sex: opts.sex ?? 'U',
    birth: opts.birthYear
      ? { date: { raw: '', year: opts.birthYear, month: null, day: null, display: '' }, place: '' }
      : null,
    death: opts.deathYear
      ? { date: { raw: '', year: opts.deathYear, month: null, day: null, display: '' }, place: '' }
      : null,
    occupation: '',
    note: '',
    famc: opts.famc ?? [],
    fams: opts.fams ?? [],
  };
}

function mkFamily(
  id: string,
  opts: { husband?: string; wife?: string; children?: string[] } = {},
): Family {
  return {
    id,
    husband: opts.husband ?? null,
    wife: opts.wife ?? null,
    children: opts.children ?? [],
    marriage: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sosa-Stradonitz  (Implex.compute)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arbre de test :
 *
 *   I4 × I5          I6 × I7
 *      └─ I2             └─ I3
 *             └─── I1 ───┘
 *
 * Sosa : I1=1, I2=2, I3=3, I4=4, I5=5, I6=6, I7=7
 */
function buildSosaTree() {
  const individuals = new Map<string, Individual>([
    ['I1', mkPerson('I1', { famc: ['F1'] })],
    ['I2', mkPerson('I2', { sex: 'M', famc: ['F2'], fams: ['F1'] })],
    ['I3', mkPerson('I3', { sex: 'F', famc: ['F3'], fams: ['F1'] })],
    ['I4', mkPerson('I4', { sex: 'M', fams: ['F2'] })],
    ['I5', mkPerson('I5', { sex: 'F', fams: ['F2'] })],
    ['I6', mkPerson('I6', { sex: 'M', fams: ['F3'] })],
    ['I7', mkPerson('I7', { sex: 'F', fams: ['F3'] })],
  ]);
  const families = new Map<string, Family>([
    ['F1', mkFamily('F1', { husband: 'I2', wife: 'I3', children: ['I1'] })],
    ['F2', mkFamily('F2', { husband: 'I4', wife: 'I5', children: ['I2'] })],
    ['F3', mkFamily('F3', { husband: 'I6', wife: 'I7', children: ['I3'] })],
  ]);
  return { individuals, families };
}

describe('Sosa — numérotation de base', () => {
  it('la racine a sosa=1 et gen=0', () => {
    const { individuals, families } = buildSosaTree();
    const r = compute(individuals.get('I1')!, individuals, families);
    expect(r.sosaToId.get(1)).toBe('I1');
  });

  it('père = sosa×2 (I2 → 2)', () => {
    const { individuals, families } = buildSosaTree();
    const r = compute(individuals.get('I1')!, individuals, families);
    expect(r.sosaToId.get(2)).toBe('I2');
  });

  it('mère = sosa×2+1 (I3 → 3)', () => {
    const { individuals, families } = buildSosaTree();
    const r = compute(individuals.get('I1')!, individuals, families);
    expect(r.sosaToId.get(3)).toBe('I3');
  });

  it('grand-père paternel = 4', () => {
    const { individuals, families } = buildSosaTree();
    const r = compute(individuals.get('I1')!, individuals, families);
    expect(r.sosaToId.get(4)).toBe('I4');
  });

  it('grand-mère paternelle = 5', () => {
    const { individuals, families } = buildSosaTree();
    const r = compute(individuals.get('I1')!, individuals, families);
    expect(r.sosaToId.get(5)).toBe('I5');
  });

  it('grand-père maternel = 6', () => {
    const { individuals, families } = buildSosaTree();
    const r = compute(individuals.get('I1')!, individuals, families);
    expect(r.sosaToId.get(6)).toBe('I6');
  });

  it('grand-mère maternelle = 7', () => {
    const { individuals, families } = buildSosaTree();
    const r = compute(individuals.get('I1')!, individuals, families);
    expect(r.sosaToId.get(7)).toBe('I7');
  });

  it('7 individus dans sosaToId', () => {
    const { individuals, families } = buildSosaTree();
    const r = compute(individuals.get('I1')!, individuals, families);
    expect(r.sosaToId.size).toBe(7);
  });
});

describe('Sosa — génération = floor(log2(sosa))', () => {
  it('gen 0 : sosa 1', () => {
    const { individuals, families } = buildSosaTree();
    const r = compute(individuals.get('I1')!, individuals, families);
    const g0 = r.generationStats[0];
    expect(g0.generation).toBe(0);
    expect(g0.present).toBe(1);
  });

  it('gen 1 : sosa 2-3 (2 individus)', () => {
    const { individuals, families } = buildSosaTree();
    const r = compute(individuals.get('I1')!, individuals, families);
    const g1 = r.generationStats[1];
    expect(g1.present).toBe(2);
    expect(g1.theoretical).toBe(2);
    expect(g1.completeness).toBe(100);
  });

  it('gen 2 : sosa 4-7 (4 individus)', () => {
    const { individuals, families } = buildSosaTree();
    const r = compute(individuals.get('I1')!, individuals, families);
    const g2 = r.generationStats[2];
    expect(g2.present).toBe(4);
    expect(g2.distinct).toBe(4);
  });
});

describe('Sosa — sans parents', () => {
  it('racine sans parents : 1 seul individu, aucun ancêtre', () => {
    const individuals = new Map([['I1', mkPerson('I1')]]);
    const families = new Map<string, Family>();
    const r = compute(individuals.get('I1')!, individuals, families);
    expect(r.sosaToId.size).toBe(1);
    expect(r.totalAncestorSlots).toBe(1);
  });
});

describe('Sosa — limite maxGen', () => {
  it('maxGen=1 → seuls sosa 1,2,3 récupérés', () => {
    const { individuals, families } = buildSosaTree();
    const r = compute(individuals.get('I1')!, individuals, families, 1);
    expect(r.sosaToId.size).toBe(3);
    expect(r.sosaToId.has(4)).toBe(false);
  });
});

// ─── Implexe (consanguinité) ──────────────────────────────────────────────────

/**
 * Mariage consanguin : I2 et I3 ont I_COM comme ancêtre commun.
 *
 *        I_COM
 *       /      \
 *     I4        I5
 *      \        /
 *   I2  ×  I3
 *        |
 *       I1
 *
 * I_COM apparaît en sosa 8 (père de I4) et en sosa 11 (mère de I5).
 */
function buildImplexTree() {
  const individuals = new Map<string, Individual>([
    ['I1',    mkPerson('I1',    { famc: ['F1'] })],
    ['I2',    mkPerson('I2',    { sex: 'M', famc: ['F2'], fams: ['F1'] })],
    ['I3',    mkPerson('I3',    { sex: 'F', famc: ['F3'], fams: ['F1'] })],
    ['I4',    mkPerson('I4',    { sex: 'M', famc: ['F4'], fams: ['F2'] })],
    ['I5',    mkPerson('I5',    { sex: 'F', famc: ['F5'], fams: ['F3'] })],
    ['I_COM', mkPerson('I_COM', { sex: 'M', fams: ['F4', 'F5'] })],
    ['I_A',   mkPerson('I_A',   { sex: 'F', fams: ['F4'] })],
    ['I_B',   mkPerson('I_B',   { sex: 'F', fams: ['F5'] })],
  ]);
  const families = new Map<string, Family>([
    ['F1', mkFamily('F1', { husband: 'I2', wife: 'I3',    children: ['I1'] })],
    ['F2', mkFamily('F2', { husband: 'I4', wife: 'I5',    children: ['I2'] })],  // typo: I5 est dans F3, pas F2
    ['F3', mkFamily('F3', { husband: 'I4', wife: 'I5',    children: ['I3'] })],
    ['F4', mkFamily('F4', { husband: 'I_COM', wife: 'I_A', children: ['I4'] })],
    ['F5', mkFamily('F5', { husband: 'I_COM', wife: 'I_B', children: ['I5'] })],
  ]);
  return { individuals, families };
}

describe('Sosa — implexe (ancêtre commun)', () => {
  it('I_COM est détecté comme implicé (sosaNumbers.length > 1)', () => {
    const { individuals, families } = buildImplexTree();
    const r = compute(individuals.get('I1')!, individuals, families);
    const entry = r.occurrences.get('I_COM');
    expect(entry).toBeDefined();
    expect(entry!.sosaNumbers.length).toBeGreaterThan(1);
  });

  it('implexEntries contient I_COM', () => {
    const { individuals, families } = buildImplexTree();
    const r = compute(individuals.get('I1')!, individuals, families);
    expect(r.implexEntries.some((e) => e.person.id === 'I_COM')).toBe(true);
  });

  it('isImplexedFor → true pour I_COM', () => {
    const { individuals, families } = buildImplexTree();
    const r = compute(individuals.get('I1')!, individuals, families);
    expect(isImplexedFor('I_COM', r)).toBe(true);
  });

  it('isImplexedFor → false pour la racine', () => {
    const { individuals, families } = buildImplexTree();
    const r = compute(individuals.get('I1')!, individuals, families);
    expect(isImplexedFor('I1', r)).toBe(false);
  });

  it('globalEndogamy > 0 quand il y a un ancêtre commun', () => {
    const { individuals, families } = buildImplexTree();
    const r = compute(individuals.get('I1')!, individuals, families);
    expect(r.globalEndogamy).toBeGreaterThan(0);
  });

  it('isImplexedFor → false avec implexData=null', () => {
    expect(isImplexedFor('I1', null)).toBe(false);
  });
});

describe('Sosa — arbre sans implexe', () => {
  it('globalEndogamy = 0 et implexEntries vide', () => {
    const { individuals, families } = buildSosaTree();
    const r = compute(individuals.get('I1')!, individuals, families);
    expect(r.globalEndogamy).toBe(0);
    expect(r.implexEntries).toHaveLength(0);
  });

  it('distinctAncestors === totalAncestorSlots', () => {
    const { individuals, families } = buildSosaTree();
    const r = compute(individuals.get('I1')!, individuals, families);
    expect(r.distinctAncestors).toBe(r.totalAncestorSlots);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Aboville  (Descendance.computeAboville)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arbre de test :
 *
 *   I1 (racine)
 *   ├── I2 (né 1800)  → 1.1
 *   │   ├── I4 (né 1825) → 1.1.1
 *   │   └── I5 (né 1830) → 1.1.2
 *   └── I3 (né 1810)  → 1.2
 */
function buildAbovilleTree() {
  const individuals = new Map<string, Individual>([
    ['I1', mkPerson('I1', { fams: ['F1', 'F2'] })],
    ['I2', mkPerson('I2', { birthYear: 1800, fams: ['F3'] })],
    ['I3', mkPerson('I3', { birthYear: 1810 })],
    ['I4', mkPerson('I4', { birthYear: 1825 })],
    ['I5', mkPerson('I5', { birthYear: 1830 })],
  ]);
  const families = new Map<string, Family>([
    ['F1', mkFamily('F1', { husband: 'I1', children: ['I2'] })],
    ['F2', mkFamily('F2', { husband: 'I1', children: ['I3'] })],
    ['F3', mkFamily('F3', { husband: 'I2', children: ['I4', 'I5'] })],
  ]);
  return { individuals, families };
}

describe('Aboville — numérotation de base', () => {
  it('la racine vaut "1"', () => {
    const { individuals, families } = buildAbovilleTree();
    const m = computeAboville(individuals.get('I1')!, individuals, families);
    expect(m.get('I1')).toBe('1');
  });

  it('premier enfant (né 1800) → "1.1"', () => {
    const { individuals, families } = buildAbovilleTree();
    const m = computeAboville(individuals.get('I1')!, individuals, families);
    expect(m.get('I2')).toBe('1.1');
  });

  it('deuxième enfant (né 1810) → "1.2"', () => {
    const { individuals, families } = buildAbovilleTree();
    const m = computeAboville(individuals.get('I1')!, individuals, families);
    expect(m.get('I3')).toBe('1.2');
  });

  it('premier petit-enfant (né 1825) → "1.1.1"', () => {
    const { individuals, families } = buildAbovilleTree();
    const m = computeAboville(individuals.get('I1')!, individuals, families);
    expect(m.get('I4')).toBe('1.1.1');
  });

  it('deuxième petit-enfant (né 1830) → "1.1.2"', () => {
    const { individuals, families } = buildAbovilleTree();
    const m = computeAboville(individuals.get('I1')!, individuals, families);
    expect(m.get('I5')).toBe('1.1.2');
  });

  it('5 entrées au total', () => {
    const { individuals, families } = buildAbovilleTree();
    const m = computeAboville(individuals.get('I1')!, individuals, families);
    expect(m.size).toBe(5);
  });
});

describe('Aboville — tri par année de naissance', () => {
  it('enfant sans date de naissance trié après les enfants datés', () => {
    const individuals = new Map<string, Individual>([
      ['I1', mkPerson('I1', { fams: ['F1'] })],
      ['I2', mkPerson('I2', { birthYear: 1800 })],
      ['I3', mkPerson('I3')], // sans date → trié 9999
    ]);
    const families = new Map<string, Family>([
      ['F1', mkFamily('F1', { children: ['I3', 'I2'] })], // ordre inversé dans GEDCOM
    ]);
    const m = computeAboville(individuals.get('I1')!, individuals, families);
    expect(m.get('I2')).toBe('1.1'); // I2 en premier (né 1800)
    expect(m.get('I3')).toBe('1.2'); // I3 en second (9999)
  });
});

describe('Aboville — limite maxGen', () => {
  // gen=0 → la racine traite ses enfants (gen=1) mais pas plus loin
  it('maxGen=0 → seuls la racine et ses enfants directs sont inclus', () => {
    const { individuals, families } = buildAbovilleTree();
    const m = computeAboville(individuals.get('I1')!, individuals, families, 0);
    expect(m.has('I4')).toBe(false);
    expect(m.has('I5')).toBe(false);
    expect(m.size).toBe(3); // I1, I2, I3
  });
});

describe('Aboville — déduplication', () => {
  it('un enfant dans deux familles ne reçoit qu\'un seul code', () => {
    const individuals = new Map<string, Individual>([
      ['I1', mkPerson('I1', { fams: ['F1', 'F2'] })],
      ['I2', mkPerson('I2')],
    ]);
    const families = new Map<string, Family>([
      ['F1', mkFamily('F1', { husband: 'I1', children: ['I2'] })],
      ['F2', mkFamily('F2', { husband: 'I1', children: ['I2'] })], // doublon
    ]);
    const m = computeAboville(individuals.get('I1')!, individuals, families);
    expect(m.get('I2')).toBe('1.1');
    expect(m.size).toBe(2);
  });
});

describe('Aboville — racine sans descendants', () => {
  it('retourne uniquement la racine', () => {
    const individuals = new Map([['I1', mkPerson('I1')]]);
    const families = new Map<string, Family>();
    const m = computeAboville(individuals.get('I1')!, individuals, families);
    expect(m.size).toBe(1);
    expect(m.get('I1')).toBe('1');
  });
});

// ─── findDeadBranches ─────────────────────────────────────────────────────────

describe('findDeadBranches', () => {
  it('individu sans enfants est une branche morte', () => {
    const { individuals, families } = buildAbovilleTree();
    const dead = findDeadBranches(individuals, families);
    const ids = dead.map((p) => p.id);
    expect(ids).toContain('I3');
    expect(ids).toContain('I4');
    expect(ids).toContain('I5');
  });

  it('individu avec enfants n\'est pas une branche morte', () => {
    const { individuals, families } = buildAbovilleTree();
    const dead = findDeadBranches(individuals, families);
    const ids = dead.map((p) => p.id);
    expect(ids).not.toContain('I1');
    expect(ids).not.toContain('I2');
  });

  it('tous les individus sont des branches mortes si aucune famille n\'a d\'enfants', () => {
    const individuals = new Map([
      ['I1', mkPerson('I1')],
      ['I2', mkPerson('I2')],
    ]);
    const families = new Map([['F1', mkFamily('F1', { husband: 'I1', wife: 'I2' })]]);
    expect(findDeadBranches(individuals, families)).toHaveLength(2);
  });
});

// ─── computeCohortLifeExpectancy ──────────────────────────────────────────────

describe('computeCohortLifeExpectancy', () => {
  it('calcule la moyenne pour une décennie', () => {
    const individuals = new Map<string, Individual>([
      ['I1', mkPerson('I1', { sex: 'M', birthYear: 1800, deathYear: 1870 })],
      ['I2', mkPerson('I2', { sex: 'F', birthYear: 1805, deathYear: 1885 })],
    ]);
    const result = computeCohortLifeExpectancy(individuals);
    const d1800 = result.find((c) => c.decade === 1800)!;
    expect(d1800).toBeDefined();
    expect(d1800.avgAll).toBeCloseTo((70 + 80) / 2, 5);
    expect(d1800.avgM).toBeCloseTo(70, 5);
    expect(d1800.avgF).toBeCloseTo(80, 5);
    expect(d1800.countAll).toBe(2);
  });

  it('ignore les individus sans naissance ou sans décès', () => {
    const individuals = new Map<string, Individual>([
      ['I1', mkPerson('I1', { birthYear: 1800 })], // pas de décès
      ['I2', mkPerson('I2', { deathYear: 1870 })], // pas de naissance
    ]);
    expect(computeCohortLifeExpectancy(individuals)).toHaveLength(0);
  });

  it('ignore les durées négatives ou > 120 ans', () => {
    const individuals = new Map<string, Individual>([
      ['I1', mkPerson('I1', { birthYear: 1800, deathYear: 1795 })], // négatif
      ['I2', mkPerson('I2', { birthYear: 1700, deathYear: 1900 })], // 200 ans
    ]);
    expect(computeCohortLifeExpectancy(individuals)).toHaveLength(0);
  });

  it('trie les résultats par décennie croissante', () => {
    const individuals = new Map<string, Individual>([
      ['I1', mkPerson('I1', { birthYear: 1850, deathYear: 1920 })],
      ['I2', mkPerson('I2', { birthYear: 1800, deathYear: 1870 })],
    ]);
    const result = computeCohortLifeExpectancy(individuals);
    expect(result[0].decade).toBeLessThan(result[1].decade);
  });
});
