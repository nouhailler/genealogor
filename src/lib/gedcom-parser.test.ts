import { describe, it, expect } from 'vitest';
import { parse } from '@/lib/gedcom-parser';

// ─── helpers ──────────────────────────────────────────────────────────────────

function minimal(body: string): string {
  return `0 HEAD\n1 GEDC\n2 VERS 5.5.1\n${body}\n0 TRLR`;
}

// ─── parse() — cas de base ────────────────────────────────────────────────────

describe('parse — entrée invalide', () => {
  it('retourne une erreur pour une chaîne vide', () => {
    const r = parse('');
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.individuals.size).toBe(0);
  });

  it('retourne une erreur pour une valeur non-string', () => {
    // @ts-expect-error test volontaire
    const r = parse(null);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('signale un HEAD manquant', () => {
    const r = parse('0 @I1@ INDI\n1 NAME Jean /Dupont/\n0 TRLR');
    expect(r.errors.some((e) => e.message.includes('HEAD'))).toBe(true);
  });

  it('signale l\'absence d\'individus', () => {
    const r = parse('0 HEAD\n1 GEDC\n2 VERS 5.5.1\n0 TRLR');
    expect(r.errors.some((e) => e.message.includes('Aucun individu'))).toBe(true);
    expect(r.individuals.size).toBe(0);
  });
});

// ─── Individus ─────────────────────────────────────────────────────────────────

describe('parse — individu simple', () => {
  const GED = minimal('0 @I1@ INDI\n1 NAME Jean /Dupont/\n1 SEX M');

  it('produit un individu', () => {
    const r = parse(GED);
    expect(r.individuals.size).toBe(1);
    expect(r.individuals.has('@I1@')).toBe(true);
  });

  it('parse le nom correctement', () => {
    const i = parse(GED).individuals.get('@I1@')!;
    expect(i.name.given).toBe('Jean');
    expect(i.name.surname).toBe('Dupont');
    expect(i.name.display).toBe('Jean Dupont');
  });

  it('parse le sexe M', () => {
    expect(parse(GED).individuals.get('@I1@')!.sex).toBe('M');
  });

  it('parse le sexe F', () => {
    const r = parse(minimal('0 @I1@ INDI\n1 NAME Marie /Curie/\n1 SEX F'));
    expect(r.individuals.get('@I1@')!.sex).toBe('F');
  });

  it('sexe inconnu → U', () => {
    const r = parse(minimal('0 @I1@ INDI\n1 NAME X /Y/'));
    expect(r.individuals.get('@I1@')!.sex).toBe('U');
  });
});

describe('parse — nom sans barres obliques', () => {
  it('met le texte brut dans given', () => {
    const r = parse(minimal('0 @I1@ INDI\n1 NAME Jacques'));
    const i = r.individuals.get('@I1@')!;
    expect(i.name.given).toBe('Jacques');
    expect(i.name.surname).toBe('');
  });
});

describe('parse — prénom/nom via GIVN/SURN', () => {
  it('GIVN et SURN priment sur les barres', () => {
    const GED = minimal(
      '0 @I1@ INDI\n1 NAME Jean /Dupont/\n2 GIVN Jean-Paul\n2 SURN Martin',
    );
    const i = parse(GED).individuals.get('@I1@')!;
    expect(i.name.given).toBe('Jean-Paul');
    expect(i.name.surname).toBe('Martin');
    expect(i.name.display).toBe('Jean-Paul Martin');
  });
});

describe('parse — individu sans nom', () => {
  it('display vaut "(Sans nom)"', () => {
    const r = parse(minimal('0 @I1@ INDI\n1 SEX M'));
    expect(r.individuals.get('@I1@')!.name.display).toBe('(Sans nom)');
  });
});

// ─── Événements ────────────────────────────────────────────────────────────────

describe('parse — naissance', () => {
  const GED = minimal(
    '0 @I1@ INDI\n1 NAME Pierre /Martin/\n1 BIRT\n2 DATE 15 JAN 1920\n2 PLAC Paris, France',
  );

  it('parse la date complète', () => {
    const birth = parse(GED).individuals.get('@I1@')!.birth!;
    expect(birth.date.year).toBe(1920);
    expect(birth.date.month).toBe(1);
    expect(birth.date.day).toBe(15);
    expect(birth.date.display).toBe('15 janv. 1920');
  });

  it('parse le lieu', () => {
    expect(parse(GED).individuals.get('@I1@')!.birth!.place).toBe('Paris, France');
  });
});

describe('parse — décès', () => {
  const GED = minimal(
    '0 @I1@ INDI\n1 NAME Marie /Dupont/\n1 DEAT\n2 DATE DEC 1985',
  );

  it('parse une date mois+année', () => {
    const death = parse(GED).individuals.get('@I1@')!.death!;
    expect(death.date.year).toBe(1985);
    expect(death.date.month).toBe(12);
    expect(death.date.day).toBeNull();
    expect(death.date.display).toBe('déc. 1985');
  });
});

describe('parse — qualificatifs de date', () => {
  it('ABT → "vers"', () => {
    const GED = minimal('0 @I1@ INDI\n1 NAME X /Y/\n1 BIRT\n2 DATE ABT 1900');
    const d = parse(GED).individuals.get('@I1@')!.birth!.date;
    expect(d.year).toBe(1900);
    expect(d.display).toContain('vers');
  });

  it('BEF → "avant"', () => {
    const GED = minimal('0 @I1@ INDI\n1 NAME X /Y/\n1 BIRT\n2 DATE BEF 1850');
    const d = parse(GED).individuals.get('@I1@')!.birth!.date;
    expect(d.display).toContain('avant');
  });

  it('AFT → "après"', () => {
    const GED = minimal('0 @I1@ INDI\n1 NAME X /Y/\n1 DEAT\n2 DATE AFT 1900');
    const d = parse(GED).individuals.get('@I1@')!.death!.date;
    expect(d.display).toContain('après');
  });
});

describe('parse — individu sans naissance ni décès', () => {
  it('birth et death sont null', () => {
    const r = parse(minimal('0 @I1@ INDI\n1 NAME A /B/'));
    const i = r.individuals.get('@I1@')!;
    expect(i.birth).toBeNull();
    expect(i.death).toBeNull();
  });
});

// ─── Familles ─────────────────────────────────────────────────────────────────

describe('parse — famille simple', () => {
  const GED = minimal(
    '0 @I1@ INDI\n1 NAME Pierre /D/\n1 SEX M\n1 FAMS @F1@\n' +
    '0 @I2@ INDI\n1 NAME Marie /D/\n1 SEX F\n1 FAMS @F1@\n' +
    '0 @I3@ INDI\n1 NAME Enfant /D/\n1 FAMC @F1@\n' +
    '0 @F1@ FAM\n1 HUSB @I1@\n1 WIFE @I2@\n1 CHIL @I3@',
  );

  it('parse mari, femme et enfant', () => {
    const r = parse(GED);
    const f = r.families.get('@F1@')!;
    expect(f.husband).toBe('@I1@');
    expect(f.wife).toBe('@I2@');
    expect(f.children).toEqual(['@I3@']);
  });

  it('les liens FAMS/FAMC de l\'individu sont corrects', () => {
    const r = parse(GED);
    expect(r.individuals.get('@I1@')!.fams).toContain('@F1@');
    expect(r.individuals.get('@I3@')!.famc).toContain('@F1@');
  });
});

describe('parse — mariage', () => {
  const GED = minimal(
    '0 @I1@ INDI\n1 NAME A /B/\n' +
    '0 @F1@ FAM\n1 HUSB @I1@\n1 MARR\n2 DATE 20 JUN 1950\n2 PLAC Lyon, France',
  );

  it('parse la date de mariage', () => {
    const m = parse(GED).families.get('@F1@')!.marriage!;
    expect(m.date.year).toBe(1950);
    expect(m.date.month).toBe(6);
    expect(m.date.day).toBe(20);
    expect(m.date.display).toBe('20 juin 1950');
  });

  it('parse le lieu de mariage', () => {
    expect(parse(GED).families.get('@F1@')!.marriage!.place).toBe('Lyon, France');
  });
});

describe('parse — famille sans conjoint', () => {
  it('husband et wife sont null', () => {
    const GED = minimal('0 @I1@ INDI\n1 NAME A /B/\n1 FAMC @F1@\n0 @F1@ FAM\n1 CHIL @I1@');
    const f = parse(GED).families.get('@F1@')!;
    expect(f.husband).toBeNull();
    expect(f.wife).toBeNull();
    expect(f.children).toEqual(['@I1@']);
  });
});

// ─── Champs texte libres ──────────────────────────────────────────────────────

describe('parse — occupation et note', () => {
  const GED = minimal(
    '0 @I1@ INDI\n1 NAME Paul /V/\n1 OCCU Médecin\n1 NOTE Première ligne\n2 CONT Suite de la note',
  );

  it('parse l\'occupation', () => {
    expect(parse(GED).individuals.get('@I1@')!.occupation).toBe('Médecin');
  });

  it('concatène les lignes de note via CONT', () => {
    const note = parse(GED).individuals.get('@I1@')!.note;
    expect(note).toBe('Première ligne\nSuite de la note');
  });
});

// ─── Encodage & robustesse ───────────────────────────────────────────────────

describe('parse — robustesse', () => {
  it('gère le BOM UTF-8', () => {
    const GED = '﻿' + minimal('0 @I1@ INDI\n1 NAME Jean /D/');
    expect(parse(GED).individuals.size).toBe(1);
  });

  it('gère les fins de ligne Windows (CRLF)', () => {
    const GED = minimal('0 @I1@ INDI\r\n1 NAME Jean /D/');
    expect(parse(GED).individuals.size).toBe(1);
  });

  it('plusieurs individus', () => {
    const GED = minimal(
      '0 @I1@ INDI\n1 NAME A /B/\n0 @I2@ INDI\n1 NAME C /D/\n0 @I3@ INDI\n1 NAME E /F/',
    );
    expect(parse(GED).individuals.size).toBe(3);
  });

  it('les erreurs de ligne sont collectées sans planter', () => {
    const GED = minimal('0 @I1@ INDI\n1 NAME A /B/\nLIGNE INVALIDE\nAUTRE INVALIDE');
    const r = parse(GED);
    expect(r.individuals.size).toBe(1);
    expect(r.errors.some((e) => e.message.includes('mal formée'))).toBe(true);
  });
});
