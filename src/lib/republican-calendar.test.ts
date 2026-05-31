import { describe, it, expect } from 'vitest';
import { fromGregorian, format, formatGregorian, formatYear, isInPeriod } from '@/lib/republican-calendar';

// ─── fromGregorian ─────────────────────────────────────────────────────────────

describe('fromGregorian — hors période', () => {
  it('retourne null avant le 22 sept 1792', () => {
    expect(fromGregorian(1792, 9, 21)).toBeNull();
  });

  it('retourne null le 1er janv 1806 (fin de période)', () => {
    expect(fromGregorian(1806, 1, 1)).toBeNull();
  });

  it('retourne null pour une date moderne', () => {
    expect(fromGregorian(2024, 6, 15)).toBeNull();
  });

  it('retourne null si un paramètre vaut 0', () => {
    expect(fromGregorian(0, 9, 22)).toBeNull();
    expect(fromGregorian(1792, 0, 22)).toBeNull();
    expect(fromGregorian(1792, 9, 0)).toBeNull();
  });
});

describe('fromGregorian — dates de référence vérifiées', () => {
  it('22 sept 1792 → 1 Vendémiaire an I', () => {
    const r = fromGregorian(1792, 9, 22)!;
    expect(r.year).toBe(1);
    expect(r.monthIdx).toBe(0); // Vendémiaire
    expect(r.dayOfMonth).toBe(1);
  });

  it('22 sept 1793 → 1 Vendémiaire an II', () => {
    const r = fromGregorian(1793, 9, 22)!;
    expect(r.year).toBe(2);
    expect(r.monthIdx).toBe(0);
    expect(r.dayOfMonth).toBe(1);
  });

  it('21 janv 1793 (exécution Louis XVI) → 2 Pluviôse an I', () => {
    // Pluviôse = mois 5 (index 4), 92 jours après le 22 sept 1792 = jour 93
    // 22 sept → 31 oct = 39j | 1 nov → 30 nov = 30j | 1 dec → 31 dec = 31j | 1 jan → 21 jan = 21j = 121j
    // 121 / 30 = mois idx 4 (Pluviôse), jour = 121 % 30 + 1 = 2
    const r = fromGregorian(1793, 1, 21)!;
    expect(r).not.toBeNull();
    expect(r.monthIdx).toBe(4); // Pluviôse
    expect(r.dayOfMonth).toBe(2);
    expect(r.year).toBe(1);
  });

  it('9 thermidor an II (27 juil 1794) — chute de Robespierre', () => {
    const r = fromGregorian(1794, 7, 27)!;
    expect(r.year).toBe(2);
    expect(r.monthIdx).toBe(10); // Thermidor
    expect(r.dayOfMonth).toBe(9);
  });

  it('18 Brumaire an VIII (9 nov 1799) — coup de Bonaparte', () => {
    const r = fromGregorian(1799, 11, 9)!;
    expect(r.year).toBe(8);
    expect(r.monthIdx).toBe(1); // Brumaire
    expect(r.dayOfMonth).toBe(18);
  });

  it('dernier jour avant la fin — 31 déc 1805', () => {
    const r = fromGregorian(1805, 12, 31);
    expect(r).not.toBeNull();
  });
});

describe('fromGregorian — jours complémentaires (sans-culottides)', () => {
  // An I : 22 sept 1792 (jour 0) → jours complémentaires = jours 360-364
  // jour 360 = 17 sept 1793, jour 364 = 21 sept 1793
  it('1er jour complémentaire an I (17 sept 1793)', () => {
    const r = fromGregorian(1793, 9, 17)!;
    expect(r.monthIdx).toBe(12); // sans-culottides
    expect(r.dayOfMonth).toBe(1);
    expect(r.year).toBe(1);
  });

  it('5e jour complémentaire an I (21 sept 1793)', () => {
    const r = fromGregorian(1793, 9, 21)!;
    expect(r.monthIdx).toBe(12);
    expect(r.dayOfMonth).toBe(5);
  });

  // An III est bissextile républicain : year 3 → 22 sept 1794 à 22 sept 1795 (366 j)
  // jour 365 = 22 sept 1795 → 6e jour complémentaire
  it('6e jour complémentaire an III (22 sept 1795 — année sextile)', () => {
    const r = fromGregorian(1795, 9, 22)!;
    expect(r.monthIdx).toBe(12);
    expect(r.dayOfMonth).toBe(6);
    expect(r.year).toBe(3);
  });
});

// ─── format ────────────────────────────────────────────────────────────────────

describe('format — mois normaux', () => {
  it('format long', () => {
    const rep = fromGregorian(1792, 9, 22)!;
    expect(format(rep)).toBe('1 Vendémiaire an I');
  });

  it('format court', () => {
    const rep = fromGregorian(1792, 9, 22)!;
    expect(format(rep, { short: true })).toBe('1 Vend. an I');
  });

  it('an II en romain', () => {
    const rep = fromGregorian(1793, 9, 22)!;
    expect(format(rep)).toContain('an II');
  });

  it('an VIII en romain', () => {
    const rep = fromGregorian(1799, 11, 9)!;
    expect(format(rep)).toContain('an VIII');
  });

  it('retourne "" pour null', () => {
    expect(format(null)).toBe('');
  });
});

describe('format — jours complémentaires', () => {
  it('jour 1 → "jour de la Vertu"', () => {
    const rep = fromGregorian(1793, 9, 17)!;
    expect(format(rep)).toContain('jour de la Vertu');
  });

  it('jour 6 → "jour de la Révolution" (an III sextile)', () => {
    const rep = fromGregorian(1795, 9, 22)!;
    expect(format(rep)).toContain('jour de la Révolution');
  });
});

// ─── formatGregorian ──────────────────────────────────────────────────────────

describe('formatGregorian', () => {
  it('convertit et formate d\'un coup', () => {
    expect(formatGregorian(1799, 11, 9)).toBe('18 Brumaire an VIII');
  });

  it('retourne null hors période', () => {
    expect(formatGregorian(2024, 1, 1)).toBeNull();
  });

  it('option short transmise correctement', () => {
    const s = formatGregorian(1792, 9, 22, { short: true });
    expect(s).toBe('1 Vend. an I');
  });
});

// ─── formatYear ───────────────────────────────────────────────────────────────

describe('formatYear', () => {
  it('1793 → "an I"', () => {
    expect(formatYear(1793)).toBe('an I');
  });

  it('1799 → "an VII" ou "an VIII" selon le mois de référence', () => {
    // La fonction utilise le 15 avril comme date de référence
    // 15 avr 1799 tombe dans l'an VII (qui débute le 22 sept 1798)
    expect(formatYear(1799)).toBe('an VII');
  });

  it('1800 → "an VIII"', () => {
    expect(formatYear(1800)).toBe('an VIII');
  });

  it('retourne null avant 1793', () => {
    expect(formatYear(1792)).toBeNull();
    expect(formatYear(1700)).toBeNull();
  });

  it('retourne null après 1805', () => {
    expect(formatYear(1806)).toBeNull();
    expect(formatYear(2024)).toBeNull();
  });

  it('retourne null pour 0', () => {
    expect(formatYear(0)).toBeNull();
  });
});

// ─── isInPeriod ───────────────────────────────────────────────────────────────

describe('isInPeriod', () => {
  it('1792 → true', () => expect(isInPeriod(1792)).toBe(true));
  it('1805 → true', () => expect(isInPeriod(1805)).toBe(true));
  it('1800 → true', () => expect(isInPeriod(1800)).toBe(true));
  it('1791 → false', () => expect(isInPeriod(1791)).toBe(false));
  it('1806 → false', () => expect(isInPeriod(1806)).toBe(false));
  it('null → false', () => expect(isInPeriod(null)).toBe(false));
  it('undefined → false', () => expect(isInPeriod(undefined)).toBe(false));
});
