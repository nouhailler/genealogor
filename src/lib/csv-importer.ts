import type { GenealogyData, Individual, Family, GDate } from '@/types/genealogy';

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function parseYear(s: string): number | null {
  const m = s.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

function dateObj(s: string): GDate {
  return { raw: s, year: parseYear(s), month: null, day: null, display: s };
}

export function importCSV(text: string): GenealogyData {
  const rows = parseCSV(text);
  if (rows.length < 2)
    return { individuals: new Map(), families: new Map(), errors: [{ message: 'CSV vide' }] };

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);
  const firstOf = (...names: string[]) => {
    for (const n of names) { const i = idx(n); if (i >= 0) return i; }
    return -1;
  };

  const colMap = {
    id: idx('id'),
    given: firstOf('given', 'prénom', 'prenom'),
    surname: firstOf('surname', 'nom', 'patronyme'),
    sex: firstOf('sex', 'sexe'),
    birthDate: firstOf('birthdate', 'naissance'),
    birthPlace: firstOf('birthplace', 'lieu_naissance'),
    deathDate: firstOf('deathdate', 'décès', 'deces'),
    deathPlace: firstOf('deathplace', 'lieu_deces'),
    occupation: firstOf('occupation', 'profession'),
    note: idx('note'),
    fatherId: firstOf('fatherid', 'père', 'pere'),
    motherId: firstOf('motherid', 'mère', 'mere'),
  };

  const individuals = new Map<string, Individual>();
  const families = new Map<string, Family>();
  const errors: GenealogyData['errors'] = [];
  let autoId = 1;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((c) => !c || !c.trim())) continue;
    const get = (key: keyof typeof colMap) => {
      const i = colMap[key];
      return i >= 0 && i < row.length ? row[i].trim() : '';
    };

    let id = get('id');
    if (!id) id = `@I${autoId++}@`;
    else if (!id.startsWith('@')) id = `@${id}@`;

    const given = get('given');
    const surname = get('surname');
    const display = [given, surname].filter(Boolean).join(' ') || `Individu ${r}`;
    const bDate = get('birthDate');
    const bPlace = get('birthPlace');
    const dDate = get('deathDate');
    const dPlace = get('deathPlace');

    const person: Individual = {
      id,
      name: { given, surname, display },
      sex: (get('sex').toUpperCase().charAt(0) as 'M' | 'F') || 'U',
      birth: bDate || bPlace ? { date: bDate ? dateObj(bDate) : { raw: '', year: null, month: null, day: null, display: '' }, place: bPlace } : null,
      death: dDate || dPlace ? { date: dDate ? dateObj(dDate) : { raw: '', year: null, month: null, day: null, display: '' }, place: dPlace } : null,
      occupation: get('occupation'),
      note: get('note'),
      famc: [],
      fams: [],
    };
    individuals.set(id, person);
  }

  let famAuto = 1;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (key: keyof typeof colMap) => {
      const i = colMap[key];
      return i >= 0 && i < row.length ? row[i].trim() : '';
    };
    const rawId = get('id');
    const childId = rawId ? (rawId.startsWith('@') ? rawId : `@${rawId}@`) : null;
    if (!childId || !individuals.has(childId)) continue;

    const fRaw = get('fatherId');
    const mRaw = get('motherId');
    const fatherId = fRaw ? (fRaw.startsWith('@') ? fRaw : `@${fRaw}@`) : null;
    const motherId = mRaw ? (mRaw.startsWith('@') ? mRaw : `@${mRaw}@`) : null;
    if (!fatherId && !motherId) continue;

    let famId: string | null = null;
    for (const [fid, f] of families) {
      if (f.husband === fatherId && f.wife === motherId) { famId = fid; break; }
    }
    if (!famId) {
      famId = `@F${famAuto++}@`;
      families.set(famId, { id: famId, husband: fatherId, wife: motherId, children: [], marriage: null });
      if (fatherId && individuals.has(fatherId)) individuals.get(fatherId)!.fams.push(famId);
      if (motherId && individuals.has(motherId)) individuals.get(motherId)!.fams.push(famId);
    }
    families.get(famId)!.children.push(childId);
    individuals.get(childId)!.famc.push(famId);
  }

  return { individuals, families, errors };
}

export const CsvImporter = { import: importCSV };
