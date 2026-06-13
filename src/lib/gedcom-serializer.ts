// GEDCOM serializer — produces valid GEDCOM 5.5.1 and 7.0 output from our data model.
import type { Individual, Family } from '@/types/genealogy';

export interface SerializeOptions {
  filename?: string;
  submitter?: string;
}

const MONTH_ABBRS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// ── helpers ────────────────────────────────────────────────────────────────

function escapeGedcom(s: string): string {
  return (s || '').replace(/\r?\n/g, '\n2 CONT ');
}

function dateToGedcom(date: Individual['birth'] extends null ? never : NonNullable<Individual['birth']>['date'] | null | undefined): string | null {
  if (!date) return null;
  if (date.raw) return date.raw;
  if (date.display) return date.display;
  if (date.year) return String(date.year);
  return null;
}

// ── GEDCOM 5.5.1 ──────────────────────────────────────────────────────────

function serializeIndividual(p: Individual, lines: string[]): void {
  lines.push(`0 ${p.id} INDI`);
  if (p.name) {
    const given = p.name.given || '';
    const surname = p.name.surname || '';
    lines.push(`1 NAME ${given} /${surname}/`.trim());
    if (given) lines.push(`2 GIVN ${given}`);
    if (surname) lines.push(`2 SURN ${surname}`);
  }
  if (p.sex === 'M' || p.sex === 'F') lines.push(`1 SEX ${p.sex}`);
  if (p.birth && (p.birth.date || p.birth.place)) {
    lines.push('1 BIRT');
    const d = dateToGedcom(p.birth.date);
    if (d) lines.push(`2 DATE ${d}`);
    if (p.birth.place) lines.push(`2 PLAC ${p.birth.place}`);
  }
  if (p.death && (p.death.date || p.death.place)) {
    lines.push('1 DEAT');
    const d = dateToGedcom(p.death.date);
    if (d) lines.push(`2 DATE ${d}`);
    if (p.death.place) lines.push(`2 PLAC ${p.death.place}`);
  }
  if (p.occupation) lines.push(`1 OCCU ${p.occupation}`);
  if (p.note) lines.push(`1 NOTE ${escapeGedcom(p.note)}`);
  if (p.gphotosAlbum) lines.push(`1 _GPHOTOS ${p.gphotosAlbum}`);
  if (p.portraitUrl) lines.push(`1 _PORTRAIT ${p.portraitUrl}`);
  for (const fid of p.famc || []) lines.push(`1 FAMC ${fid}`);
  for (const fid of p.fams || []) lines.push(`1 FAMS ${fid}`);
}

function serializeFamily(f: Family, lines: string[]): void {
  lines.push(`0 ${f.id} FAM`);
  if (f.husband) lines.push(`1 HUSB ${f.husband}`);
  if (f.wife) lines.push(`1 WIFE ${f.wife}`);
  for (const c of f.children || []) lines.push(`1 CHIL ${c}`);
  if (f.marriage && (f.marriage.date || f.marriage.place)) {
    lines.push('1 MARR');
    const d = dateToGedcom(f.marriage.date);
    if (d) lines.push(`2 DATE ${d}`);
    if (f.marriage.place) lines.push(`2 PLAC ${f.marriage.place}`);
  }
}

export function serialize(
  individuals: Map<string, Individual>,
  families: Map<string, Family>,
  options: SerializeOptions = {},
): string {
  const lines: string[] = [];
  const now = new Date();
  const date = `${String(now.getDate()).padStart(2, '0')} ${MONTH_ABBRS[now.getMonth()]} ${now.getFullYear()}`;

  lines.push('0 HEAD');
  lines.push('1 SOUR Genealogor');
  lines.push('2 VERS 0.6');
  lines.push('2 NAME Genealogor');
  lines.push('1 DEST ANY');
  lines.push(`1 DATE ${date}`);
  lines.push('1 CHAR UTF-8');
  lines.push('1 GEDC');
  lines.push('2 VERS 5.5.1');
  lines.push('2 FORM LINEAGE-LINKED');
  if (options.submitter) lines.push('1 SUBM @SUB1@');

  for (const p of individuals.values()) serializeIndividual(p, lines);
  for (const f of families.values()) serializeFamily(f, lines);

  if (options.submitter) {
    lines.push('0 @SUB1@ SUBM');
    lines.push(`1 NAME ${options.submitter}`);
  }
  lines.push('0 TRLR');
  return lines.join('\n');
}

export function download(
  individuals: Map<string, Individual>,
  families: Map<string, Family>,
  options: SerializeOptions = {},
): void {
  const text = serialize(individuals, families, options);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = options.filename || `genealogie-${new Date().toISOString().slice(0, 10)}.ged`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── GEDCOM 7.0 ────────────────────────────────────────────────────────────

function gedcom7Date(date: NonNullable<Individual['birth']>['date'] | null | undefined): string | null {
  if (!date) return null;
  if (date.raw) return date.raw.toUpperCase().replace(/\bABOUT\b/g, 'ABT');
  if (date.display) return date.display;
  if (date.year) return String(date.year);
  return null;
}

function note7(lines: string[], level: number, text: string): void {
  if (!text) return;
  const parts = String(text).split(/\r?\n/);
  lines.push(`${level} NOTE ${parts[0]}`);
  for (let i = 1; i < parts.length; i++) lines.push(`${level + 1} CONT ${parts[i]}`);
}

function serializeIndividual7(p: Individual, lines: string[]): void {
  lines.push(`0 ${p.id} INDI`);
  if (p.name) {
    const given = p.name.given || '';
    const surname = p.name.surname || '';
    lines.push(`1 NAME ${given} /${surname}/`.trim());
    if (given) lines.push(`2 GIVN ${given}`);
    if (surname) lines.push(`2 SURN ${surname}`);
  }
  const sex = p.sex === 'M' || p.sex === 'F' ? p.sex : 'U';
  lines.push(`1 SEX ${sex}`);
  if (p.birth && (p.birth.date || p.birth.place)) {
    lines.push('1 BIRT');
    const d = gedcom7Date(p.birth.date);
    if (d) lines.push(`2 DATE ${d}`);
    if (p.birth.place) lines.push(`2 PLAC ${p.birth.place}`);
  }
  if (p.death && (p.death.date || p.death.place)) {
    lines.push('1 DEAT');
    const d = gedcom7Date(p.death.date);
    if (d) lines.push(`2 DATE ${d}`);
    if (p.death.place) lines.push(`2 PLAC ${p.death.place}`);
  }
  if (p.occupation) lines.push(`1 OCCU ${p.occupation}`);
  if (p.note) note7(lines, 1, p.note);
  if (p.gphotosAlbum) lines.push(`1 _GPHOTOS ${p.gphotosAlbum}`);
  if (p.portraitUrl) lines.push(`1 _PORTRAIT ${p.portraitUrl}`);
  for (const fid of p.famc || []) lines.push(`1 FAMC ${fid}`);
  for (const fid of p.fams || []) lines.push(`1 FAMS ${fid}`);
}

function serializeFamily7(f: Family, lines: string[]): void {
  lines.push(`0 ${f.id} FAM`);
  if (f.husband) lines.push(`1 HUSB ${f.husband}`);
  if (f.wife) lines.push(`1 WIFE ${f.wife}`);
  for (const c of f.children || []) lines.push(`1 CHIL ${c}`);
  if (f.marriage && (f.marriage.date || f.marriage.place)) {
    lines.push('1 MARR');
    const d = gedcom7Date(f.marriage.date);
    if (d) lines.push(`2 DATE ${d}`);
    if (f.marriage.place) lines.push(`2 PLAC ${f.marriage.place}`);
  }
}

export function serialize7(
  individuals: Map<string, Individual>,
  families: Map<string, Family>,
  options: SerializeOptions = {},
): string {
  const lines: string[] = [];
  const now = new Date();
  const date = `${String(now.getDate()).padStart(2, '0')} ${MONTH_ABBRS[now.getMonth()]} ${now.getFullYear()}`;
  const time = now.toTimeString().slice(0, 8);

  lines.push('0 HEAD');
  lines.push('1 GEDC');
  lines.push('2 VERS 7.0');
  lines.push('1 SOUR Genealogor');
  lines.push('2 VERS 0.6');
  lines.push('2 NAME Genealogor');
  lines.push('2 CORP Genealogor');
  lines.push(`1 DATE ${date}`);
  lines.push(`2 TIME ${time}`);
  if (options.submitter) lines.push('1 SUBM @SUB1@');

  for (const p of individuals.values()) serializeIndividual7(p, lines);
  for (const f of families.values()) serializeFamily7(f, lines);

  if (options.submitter) {
    lines.push('0 @SUB1@ SUBM');
    lines.push(`1 NAME ${options.submitter}`);
  }
  lines.push('0 TRLR');
  return lines.join('\n');
}

export function download7(
  individuals: Map<string, Individual>,
  families: Map<string, Family>,
  options: SerializeOptions = {},
): void {
  const text = serialize7(individuals, families, options);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = options.filename || `genealogie-v7-${new Date().toISOString().slice(0, 10)}.ged`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const GedcomSerializer = { serialize, download, serialize7, download7 };
