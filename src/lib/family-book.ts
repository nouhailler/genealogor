// Family book — generates a printable HTML document (cover + TOC + per-person pages + index)
// and opens it in a new window for the user to Save-as-PDF.
//
// API: generate({ individuals, families, rootId, title?, subtitle?, maxGen? })

import { fromGregorian, format, formatYear, isInPeriod } from './republican-calendar';
import type { Individual, Family, GDate } from '@/types/genealogy';

function esc(s: string | null | undefined): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function vital(p: Individual): string {
  const b = p.birth?.date?.display || (p.birth?.date?.year ? String(p.birth.date.year) : null);
  const d = p.death?.date?.display || (p.death?.date?.year ? String(p.death.date.year) : null);
  if (b && d) return `${b} – ${d}`;
  if (b) return `n. ${b}`;
  if (d) return `d. ${d}`;
  return '';
}

function repDate(date: GDate | null | undefined): string {
  if (!date?.year || !isInPeriod(date.year)) return '';
  const rep = date.year && date.month && date.day
    ? fromGregorian(date.year, date.month, date.day)
    : null;
  const t = rep
    ? format(rep)
    : date.year ? formatYear(date.year) : null;
  return t ? ` (cal. rép. : ${t})` : '';
}

function collectAncestors(
  rootId: string,
  individuals: Map<string, Individual>,
  families: Map<string, Family>,
  maxGen: number,
): Array<{ sosa: number; gen: number; person: Individual }> {
  const order: Array<{ sosa: number; gen: number; person: Individual }> = [];

  function visit(id: string, sosa: number, gen: number) {
    if (!id || gen > maxGen) return;
    const p = individuals.get(id);
    if (!p) return;
    order.push({ sosa, gen, person: p });
    const fam = p.famc?.[0] ? families.get(p.famc[0]) : null;
    if (!fam) return;
    if (fam.husband) visit(fam.husband, sosa * 2, gen + 1);
    if (fam.wife) visit(fam.wife, sosa * 2 + 1, gen + 1);
  }

  visit(rootId, 1, 0);
  return order.sort((a, b) => a.sosa - b.sosa);
}

function relationLabel(sosa: number, sex: string): string {
  if (sosa === 1) return 'Personne de référence';
  if (sosa === 2) return 'Père';
  if (sosa === 3) return 'Mère';
  const gen = Math.floor(Math.log2(sosa));
  const base = sex === 'F' ? 'Mère' : sex === 'M' ? 'Père' : 'Parent';
  if (gen === 2) return `Grand-${base === 'Mère' ? 'mère' : 'père'}`;
  const greats = gen - 2;
  return `${'Arrière-'.repeat(greats)}Grand-${base === 'Mère' ? 'mère' : 'père'}`;
}

function personPage(
  entry: { sosa: number; person: Individual },
  individuals: Map<string, Individual>,
  families: Map<string, Family>,
): string {
  const { sosa, person: p } = entry;
  const rel = relationLabel(sosa, p.sex);
  const rows: [string, string][] = [];

  const birthExtra = repDate(p.birth?.date);
  const deathExtra = repDate(p.death?.date);
  if (p.birth?.date?.display || p.birth?.place) {
    rows.push(['Naissance', `${esc(p.birth?.date?.display || '?')}${birthExtra}${p.birth?.place ? ' — ' + esc(p.birth.place) : ''}`]);
  }
  if (p.death?.date?.display || p.death?.place) {
    rows.push(['Décès', `${esc(p.death?.date?.display || '?')}${deathExtra}${p.death?.place ? ' — ' + esc(p.death.place) : ''}`]);
  }
  if (p.occupation) rows.push(['Profession', esc(p.occupation)]);

  const unions: Array<{ spouse: Individual | null; m: Individual['birth']; kids: Individual[] }> = [];
  for (const fid of p.fams || []) {
    const fam = families.get(fid);
    if (!fam) continue;
    const spouseId = fam.husband === p.id ? fam.wife : fam.husband;
    const spouse = spouseId ? individuals.get(spouseId) ?? null : null;
    const kids = (fam.children || []).map((c) => individuals.get(c)).filter((x): x is Individual => !!x);
    unions.push({ spouse, m: fam.marriage, kids });
  }

  const fam = p.famc?.[0] ? families.get(p.famc[0]) : null;
  const father = fam?.husband ? individuals.get(fam.husband) : null;
  const mother = fam?.wife ? individuals.get(fam.wife) : null;

  let html = `<section class="person-page" id="p-${esc(p.id)}">`;
  html += `<div class="sosa-badge">Sosa ${sosa}</div>`;
  html += `<div class="rel-label">${esc(rel)}</div>`;
  html += `<h2 class="person-name">${esc(p.name?.display || 'Inconnu')}</h2>`;
  html += `<div class="person-vital">${esc(vital(p))}</div>`;

  if (rows.length) {
    html += `<table class="facts">`;
    for (const [k, v] of rows) html += `<tr><th>${k}</th><td>${v}</td></tr>`;
    html += `</table>`;
  }

  if (father || mother) {
    html += `<h3>Filiation</h3><ul class="rel-list">`;
    if (father) html += `<li><span class="role">Père</span> ${esc(father.name?.display)} <span class="dim">${esc(vital(father))}</span></li>`;
    if (mother) html += `<li><span class="role">Mère</span> ${esc(mother.name?.display)} <span class="dim">${esc(vital(mother))}</span></li>`;
    html += `</ul>`;
  }

  if (unions.length) {
    html += `<h3>Union${unions.length > 1 ? 's' : ''} & postérité</h3>`;
    for (const u of unions) {
      html += `<div class="union">`;
      if (u.spouse) {
        const mEvent = u.m as Family['marriage'];
        const md = mEvent?.date?.display ? ` — mariage ${esc(mEvent.date.display)}${repDate(mEvent.date)}` : '';
        const mp = mEvent?.place ? ` à ${esc(mEvent.place)}` : '';
        html += `<div class="spouse"><span class="role">Conjoint·e</span> ${esc(u.spouse.name?.display)} <span class="dim">${esc(vital(u.spouse))}</span>${md}${mp}</div>`;
      }
      if (u.kids.length) {
        html += `<ul class="kids">`;
        for (const k of u.kids) html += `<li>${esc(k.name?.display)} <span class="dim">${esc(vital(k))}</span></li>`;
        html += `</ul>`;
      }
      html += `</div>`;
    }
  }

  if (p.note) html += `<h3>Notes</h3><p class="note">${esc(p.note)}</p>`;
  html += `</section>`;
  return html;
}

const BOOK_CSS = `
  @page { size: A4; margin: 22mm 18mm; }
  @page { @bottom-center { content: counter(page); } }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif; color: #1a1a1a; line-height: 1.5; margin: 0; font-size: 11pt; }
  .cover { height: 252mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; page-break-after: always; border: 2px solid #1a1a1a; padding: 20mm; }
  .cover .ornament { font-size: 40pt; color: #b08d57; margin-bottom: 14mm; }
  .cover h1 { font-size: 30pt; font-weight: 600; margin: 0 0 8mm; letter-spacing: 0.5px; }
  .cover .sub { font-size: 13pt; color: #555; font-style: italic; }
  .cover .date { margin-top: 20mm; font-size: 10pt; color: #888; letter-spacing: 1px; text-transform: uppercase; }
  h2.section-title { font-size: 18pt; border-bottom: 1.5pt solid #1a1a1a; padding-bottom: 3mm; margin: 0 0 8mm; page-break-after: avoid; }
  .toc { page-break-after: always; }
  .toc ul, .index ul { list-style: none; padding: 0; margin: 0; }
  .toc li a { display: flex; justify-content: space-between; align-items: baseline; text-decoration: none; color: #1a1a1a; padding: 1.6mm 0; border-bottom: 0.4pt dotted #bbb; }
  .toc-name { font-weight: 500; }
  .toc-sosa { font-size: 9pt; color: #888; font-variant-numeric: tabular-nums; }
  .person-page { page-break-before: always; padding-top: 4mm; }
  .person-page:first-of-type { page-break-before: avoid; }
  .sosa-badge { display: inline-block; font-size: 8.5pt; letter-spacing: 1px; text-transform: uppercase; color: #b08d57; border: 0.6pt solid #b08d57; border-radius: 3pt; padding: 1pt 6pt; }
  .rel-label { font-size: 9.5pt; color: #777; margin-top: 3mm; font-style: italic; }
  .person-name { font-size: 20pt; font-weight: 600; margin: 1mm 0 1mm; }
  .person-vital { font-size: 11pt; color: #555; font-variant-numeric: tabular-nums; margin-bottom: 5mm; }
  table.facts { width: 100%; border-collapse: collapse; margin: 4mm 0; }
  table.facts th { text-align: left; width: 30mm; vertical-align: top; font-weight: 600; color: #444; padding: 1.4mm 0; font-size: 10pt; }
  table.facts td { padding: 1.4mm 0; }
  h3 { font-size: 12pt; margin: 6mm 0 2mm; color: #b08d57; page-break-after: avoid; }
  ul.rel-list, ul.kids { margin: 0 0 3mm; padding-left: 5mm; }
  ul.rel-list li, ul.kids li { margin: 1mm 0; }
  .role { display: inline-block; min-width: 22mm; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5px; color: #999; }
  .union { margin-bottom: 4mm; padding-left: 2mm; border-left: 1pt solid #e0d5c0; }
  .spouse { margin-bottom: 1.5mm; }
  .dim { color: #999; font-size: 10pt; }
  .note { font-style: italic; color: #444; white-space: pre-wrap; }
  .index { page-break-before: always; }
  .index li { padding: 1mm 0; border-bottom: 0.3pt dotted #ddd; }
  .index a { text-decoration: none; color: #1a1a1a; }
  .print-hint { position: fixed; top: 0; left: 0; right: 0; background: #1a1a1a; color: #fff; padding: 10px 16px; text-align: center; font-family: -apple-system, sans-serif; font-size: 13px; z-index: 999; }
  .print-hint button { margin-left: 12px; background: #fff; color: #1a1a1a; border: 0; border-radius: 5px; padding: 5px 14px; font-weight: 600; cursor: pointer; }
  @media print { .print-hint { display: none; } }
`;

export interface BookOptions {
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  rootId: string;
  title?: string;
  subtitle?: string;
  maxGen?: number;
}

export function generate({ individuals, families, rootId, title, subtitle, maxGen = 5 }: BookOptions): void {
  const root = individuals.get(rootId);
  if (!root) {
    alert('Sélectionnez d\'abord une personne de référence pour le livre.');
    return;
  }

  const entries = collectAncestors(rootId, individuals, families, maxGen);
  const bookTitle = title || `Livre de famille — ${root.name?.display}`;
  const sub = subtitle || `Ascendance sur ${maxGen} générations · ${entries.length} individus`;
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  let toc = '';
  for (const e of entries) {
    toc += `<li><a href="#p-${esc(e.person.id)}"><span class="toc-name">${esc(e.person.name?.display || 'Inconnu')}</span><span class="toc-sosa">Sosa ${e.sosa}</span></a></li>`;
  }

  const sorted = [...entries].sort((a, b) =>
    (a.person.name?.surname || '').localeCompare(b.person.name?.surname || '', 'fr') ||
    (a.person.name?.given || '').localeCompare(b.person.name?.given || '', 'fr'),
  );
  let index = '';
  for (const e of sorted) {
    index += `<li><a href="#p-${esc(e.person.id)}">${esc(e.person.name?.surname || '?').toUpperCase()}, ${esc(e.person.name?.given || '')}</a> <span class="dim">${esc(vital(e.person))}</span></li>`;
  }

  const pages = entries.map((e) => personPage(e, individuals, families)).join('\n');

  const doc = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8" />
<title>${esc(bookTitle)}</title>
<style>${BOOK_CSS}</style></head>
<body>
  <div class="print-hint">
    Document prêt à imprimer — utilisez « Enregistrer au format PDF » dans la boîte d'impression.
    <button onclick="window.print()">Imprimer / PDF</button>
  </div>
  <div style="height: 44px;"></div>
  <div class="cover">
    <div class="ornament">❧</div>
    <h1>${esc(bookTitle)}</h1>
    <div class="sub">${esc(sub)}</div>
    <div class="date">Généré le ${esc(today)}</div>
  </div>
  <div class="toc">
    <h2 class="section-title">Table des matières</h2>
    <ul>${toc}</ul>
  </div>
  <div class="pages">${pages}</div>
  <div class="index">
    <h2 class="section-title">Index alphabétique</h2>
    <ul>${index}</ul>
  </div>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) {
    alert('Le navigateur a bloqué l\'ouverture. Autorisez les fenêtres pop-up pour générer le livre.');
    return;
  }
  w.document.open();
  w.document.write(doc);
  w.document.close();
}

export const FamilyBook = { generate };
