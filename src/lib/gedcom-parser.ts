import type { GenealogyData, Individual, Family, GEvent, IndividualName, GDate } from '@/types/genealogy';

interface GedNode {
  level: number;
  xref: string | null;
  tag: string;
  value: string;
  children: GedNode[];
}

function parseLine(raw: string): GedNode | null {
  const m = raw.match(/^\s*(\d+)\s+(?:(@[^@]+@)\s+)?(\w+)(?:\s(.*))?$/);
  if (!m) return null;
  return {
    level: parseInt(m[1], 10),
    xref: m[2] || null,
    tag: m[3],
    value: m[4] != null ? m[4] : '',
    children: [],
  };
}

function buildTree(text: string): { root: GedNode; errors: Array<{ line?: number; message: string }> } {
  text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const root: GedNode = { level: -1, xref: null, tag: 'ROOT', value: '', children: [] };
  const stack: GedNode[] = [root];
  const errors: Array<{ line?: number; message: string }> = [];

  lines.forEach((line, i) => {
    const node = parseLine(line);
    if (!node) {
      errors.push({ line: i + 1, message: `Ligne mal formée: "${line}"` });
      return;
    }
    while (stack.length > 1 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  });

  return { root, errors };
}

function findChild(node: GedNode, tag: string): GedNode | undefined {
  return node.children.find((c) => c.tag === tag);
}
function findChildren(node: GedNode, tag: string): GedNode[] {
  return node.children.filter((c) => c.tag === tag);
}

function fullValue(node: GedNode | undefined): string {
  if (!node) return '';
  let v = node.value || '';
  for (const c of node.children) {
    if (c.tag === 'CONT') v += '\n' + (c.value || '');
    else if (c.tag === 'CONC') v += c.value || '';
  }
  return v;
}

const MONTHS_FR: Record<string, string> = {
  JAN: 'janv.', FEB: 'févr.', MAR: 'mars', APR: 'avr.',
  MAY: 'mai', JUN: 'juin', JUL: 'juil.', AUG: 'août',
  SEP: 'sept.', OCT: 'oct.', NOV: 'nov.', DEC: 'déc.',
};
const MONTH_NUM: Record<string, number> = {
  JAN:1, FEB:2, MAR:3, APR:4, MAY:5, JUN:6,
  JUL:7, AUG:8, SEP:9, OCT:10, NOV:11, DEC:12,
};

function parseDate(str: string | undefined): GDate {
  if (!str) return { raw: '', year: null, month: null, day: null, display: '' };
  const raw = str.trim();
  const qualifierMap: Record<string, string> = {
    ABT: 'vers', EST: 'vers', CAL: 'vers', BEF: 'avant', AFT: 'après', BET: 'entre',
  };
  let qualifier = '';
  let rest = raw;
  const qm = raw.match(/^(ABT|EST|CAL|BEF|AFT|BET)\s+(.+)$/i);
  if (qm) {
    qualifier = qualifierMap[qm[1].toUpperCase()] || '';
    rest = qm[2];
  }
  const yearMatch = rest.match(/(\d{3,4})/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
  let display = rest;
  let month: number | null = null;
  let day: number | null = null;
  const dmy = rest.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{3,4})$/i);
  const my = rest.match(/^([A-Z]{3})\s+(\d{3,4})$/i);
  if (dmy) {
    day = parseInt(dmy[1], 10);
    month = MONTH_NUM[dmy[2].toUpperCase()] || null;
    display = `${day} ${MONTHS_FR[dmy[2].toUpperCase()] || dmy[2]} ${dmy[3]}`;
  } else if (my) {
    month = MONTH_NUM[my[1].toUpperCase()] || null;
    display = `${MONTHS_FR[my[1].toUpperCase()] || my[1]} ${my[2]}`;
  }
  if (qualifier) display = `${qualifier} ${display}`;
  return { raw, year, month, day, display };
}

function parseName(node: GedNode): IndividualName {
  const raw = node.value || '';
  let given = '', surname = '', suffix = '';
  const m = raw.match(/^([^\/]*)\/([^\/]*)\/(.*)$/);
  if (m) {
    given = m[1].trim();
    surname = m[2].trim();
    suffix = m[3].trim();
  } else {
    given = raw.trim();
  }
  const givnNode = findChild(node, 'GIVN');
  const surnNode = findChild(node, 'SURN');
  if (givnNode?.value) given = givnNode.value;
  if (surnNode?.value) surname = surnNode.value;
  const display = [given, surname].filter(Boolean).join(' ').trim();
  return { given, surname, suffix, display: display || '(Sans nom)' };
}

function parseEvent(node: GedNode | undefined): GEvent | null {
  if (!node) return null;
  const dateNode = findChild(node, 'DATE');
  const placeNode = findChild(node, 'PLAC');
  const date = dateNode ? parseDate(dateNode.value) : { raw: '', year: null, month: null, day: null, display: '' };
  const place = placeNode ? fullValue(placeNode) : '';
  return { date, place };
}

function parseIndividual(node: GedNode): Individual {
  const id = node.xref!;
  const nameNode = findChild(node, 'NAME');
  const name = nameNode ? parseName(nameNode) : { given: '', surname: '', display: '(Sans nom)' };
  const sexNode = findChild(node, 'SEX');
  const rawSex = (sexNode?.value || '').toUpperCase();
  const sex: 'M' | 'F' | 'U' = rawSex === 'M' ? 'M' : rawSex === 'F' ? 'F' : 'U';
  const birth = parseEvent(findChild(node, 'BIRT'));
  const death = parseEvent(findChild(node, 'DEAT'));
  const occupation = fullValue(findChild(node, 'OCCU'));
  const note = fullValue(findChild(node, 'NOTE'));
  const famc = findChildren(node, 'FAMC').map((n) => n.value);
  const fams = findChildren(node, 'FAMS').map((n) => n.value);
  return { id, name, sex, birth, death, occupation, note, famc, fams };
}

function parseFamily(node: GedNode): Family {
  const id = node.xref!;
  const husbNode = findChild(node, 'HUSB');
  const wifeNode = findChild(node, 'WIFE');
  const childNodes = findChildren(node, 'CHIL');
  const marriage = parseEvent(findChild(node, 'MARR'));
  return {
    id,
    husband: husbNode ? husbNode.value : null,
    wife: wifeNode ? wifeNode.value : null,
    children: childNodes.map((c) => c.value),
    marriage,
  };
}

export function parse(text: string): GenealogyData {
  const errors: GenealogyData['errors'] = [];
  if (!text || typeof text !== 'string') {
    return { individuals: new Map(), families: new Map(), errors: [{ message: 'Fichier vide ou invalide.' }] };
  }
  const { root, errors: lineErrors } = buildTree(text);
  errors.push(...lineErrors);

  const header = root.children.find((c) => c.tag === 'HEAD');
  if (!header) errors.push({ message: "En-tête GEDCOM (HEAD) manquant — le fichier est peut-être mal formé." });

  const individuals = new Map<string, Individual>();
  const families = new Map<string, Family>();

  for (const rec of root.children) {
    if (rec.tag === 'INDI' && rec.xref) {
      try {
        const indi = parseIndividual(rec);
        individuals.set(indi.id, indi);
      } catch (e) {
        errors.push({ message: `Erreur INDI ${rec.xref}: ${(e as Error).message}` });
      }
    } else if (rec.tag === 'FAM' && rec.xref) {
      try {
        const fam = parseFamily(rec);
        families.set(fam.id, fam);
      } catch (e) {
        errors.push({ message: `Erreur FAM ${rec.xref}: ${(e as Error).message}` });
      }
    }
  }

  if (individuals.size === 0) {
    errors.push({ message: "Aucun individu (INDI) trouvé. Le fichier n'est peut-être pas un GEDCOM valide." });
  }

  return { individuals, families, errors };
}

export const GedcomParser = { parse };
