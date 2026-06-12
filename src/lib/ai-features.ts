// AI feature functions — all results are cached in localStorage.
// Provider routing is handled by aiCall / aiCallMultimodal from ai-client.
import { aiCall, aiCallMultimodal } from '@/lib/ai-client';
import type { Individual, Family } from '@/types/genealogy';

// ── Cache helpers ─────────────────────────────────────────────────────────────

const CACHE_KEYS = {
  semantic:  'genealogor.semanticDedupeCache',
  research:  'genealogor.researchSuggestions',
  places:    'genealogor.normalizedPlaces',
  narrative: 'genealogor.narratives',
  shortBios: 'genealogor.shortBios',
};

function readCache<T>(key: string): Record<string, T> {
  try { return JSON.parse(localStorage.getItem(key) || '{}') as Record<string, T>; } catch { return {}; }
}
function writeCache<T>(key: string, c: Record<string, T>): void {
  try { localStorage.setItem(key, JSON.stringify(c)); } catch { /* ignore */ }
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned) as T;
}

// ── Return types ──────────────────────────────────────────────────────────────

export interface SemanticDedupeResult {
  isSame: boolean;
  confidence: number;
  reasoning?: string;
  error?: string;
}

export interface ResearchSuggestion {
  id: string;
  name: string;
  priority: number;
  reason: string;
  sources?: string[];
}

export interface ResearchSuggestionsResult {
  suggestions: ResearchSuggestion[];
  message?: string;
  error?: string;
}

export interface PlaceCluster {
  canonical: string;
  variants: string[];
}

export interface NormalizePlacesResult {
  clusters: PlaceCluster[];
  error?: string;
}

export interface NaturalQueryFilter {
  sex?: 'M' | 'F' | null;
  surnamePattern?: string | null;
  placePattern?: string | null;
  yearMin?: number | null;
  yearMax?: number | null;
  occupationPattern?: string | null;
  explanation?: string;
  error?: string;
}

export interface WikipediaEntry {
  title: string;
  desc: string;
  url: string;
}

export interface WikipediaMatch {
  title: string;
  likelyMatch: boolean;
  reason?: string;
}

export interface WikipediaCheckResult {
  wiki: WikipediaEntry[] | null;
  analysis?: {
    matches?: WikipediaMatch[];
    plausibilityNotes?: string;
    redFlags?: string[];
  };
  error?: string;
}

export interface OcrParent {
  given?: string;
  surname?: string;
  role?: string;
}

export interface OcrResult {
  actType?: 'naissance' | 'mariage' | 'décès' | 'autre' | null;
  date?: string | null;
  place?: string | null;
  principal?: {
    given?: string;
    surname?: string;
    age?: string;
    profession?: string;
  } | null;
  parents?: OcrParent[];
  spouse?: { given?: string; surname?: string } | null;
  witnesses?: string[];
  notes?: string;
  confidence?: number;
  error?: string;
}

// ── 1. Semantic duplicate detection ──────────────────────────────────────────

export async function semanticDedupe(pair: { a: Individual; b: Individual }): Promise<SemanticDedupeResult> {
  const c = readCache<SemanticDedupeResult>(CACHE_KEYS.semantic);
  const key = [pair.a.id, pair.b.id].sort().join('|');
  if (c[key]) return c[key];

  const fact = (p: Individual) => ({
    name: p.name?.display,
    sex: p.sex,
    birth: (p.birth?.date?.display ?? '') + (p.birth?.place ? ' à ' + p.birth.place : ''),
    death: (p.death?.date?.display ?? '') + (p.death?.place ? ' à ' + p.death.place : ''),
    occupation: p.occupation,
    note: p.note,
  });

  const prompt = `Tu analyses si deux fiches généalogiques décrivent la même personne. Tiens compte des variantes orthographiques (Lefèvre/Le Fèvre/Lefebvre), des métiers historiques équivalents (tisserand=tessier), des lieux approximatifs et des dates floues (vers 1820 = 1819-1821).

Fiche A : ${JSON.stringify(fact(pair.a), null, 2)}

Fiche B : ${JSON.stringify(fact(pair.b), null, 2)}

Réponds STRICTEMENT au format JSON suivant, sans markdown :
{"isSame": true|false, "confidence": 0-100, "reasoning": "courte explication en français"}`;

  try {
    const raw = await aiCall(prompt);
    const result = parseJson<SemanticDedupeResult>(raw);
    c[key] = result;
    writeCache(CACHE_KEYS.semantic, c);
    return result;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur IA', isSame: false, confidence: 0 };
  }
}

// ── 2. Research suggestions ───────────────────────────────────────────────────

export async function researchSuggestions(individuals: Map<string, Individual>): Promise<ResearchSuggestionsResult> {
  const incomplete = Array.from(individuals.values()).filter((p) =>
    !p.birth?.date?.display || !p.birth?.place || !p.death?.date?.display
  );
  if (incomplete.length === 0) return { suggestions: [], message: 'Aucune fiche incomplète.' };

  const c = readCache<ResearchSuggestionsResult>(CACHE_KEYS.research);
  const sig = incomplete.length + '-' + incomplete.slice(0, 5).map((p) => p.id).join(',');
  if (c[sig]) return c[sig];

  const items = incomplete.slice(0, 30).map((p) => ({
    id: p.id,
    name: p.name?.display,
    birth: p.birth?.date?.display || '?',
    birthPlace: p.birth?.place || '?',
    death: p.death?.date?.display || '?',
    missing: [
      !p.birth?.date?.display && 'date naissance',
      !p.birth?.place && 'lieu naissance',
      !p.death?.date?.display && 'date décès',
      !p.death?.place && 'lieu décès',
    ].filter(Boolean),
  }));

  const prompt = `Tu es un généalogiste expert. Voici des fiches incomplètes. Identifie les 5 prochaines personnes à rechercher EN PRIORITÉ, en justifiant brièvement.

Données : ${JSON.stringify(items, null, 2)}

Réponds STRICTEMENT au format JSON, sans markdown :
{"suggestions": [{"id": "@I...@", "name": "...", "priority": 1-5, "reason": "...", "sources": ["registres paroissiaux Cholet", "..."]}]}`;

  try {
    const raw = await aiCall(prompt);
    const result = parseJson<ResearchSuggestionsResult>(raw);
    c[sig] = result;
    writeCache(CACHE_KEYS.research, c);
    return result;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur IA', suggestions: [] };
  }
}

// ── 3. Place normalization ────────────────────────────────────────────────────

export async function normalizePlaces(
  individuals: Map<string, Individual>,
  families: Map<string, Family>,
): Promise<NormalizePlacesResult> {
  const set = new Set<string>();
  for (const p of individuals.values()) {
    if (p.birth?.place) set.add(p.birth.place);
    if (p.death?.place) set.add(p.death.place);
  }
  for (const f of families.values()) {
    if (f.marriage?.place) set.add(f.marriage.place);
  }
  const places = Array.from(set);
  if (places.length === 0) return { clusters: [] };

  const c = readCache<NormalizePlacesResult>(CACHE_KEYS.places);
  const sig = places.length + '-' + places.slice(0, 5).join('|');
  if (c[sig]) return c[sig];

  const prompt = `Regroupe ces lieux de France qui désignent le même endroit malgré des graphies/précisions différentes.

Lieux : ${JSON.stringify(places.slice(0, 100))}

Réponds STRICTEMENT au format JSON, sans markdown :
{"clusters": [{"canonical": "Paris", "variants": ["Paris", "Paris 14", "Paris (Seine)", "75014"]}]}
N'inclus que les clusters de 2+ lieux.`;

  try {
    const raw = await aiCall(prompt);
    const result = parseJson<NormalizePlacesResult>(raw);
    c[sig] = result;
    writeCache(CACHE_KEYS.places, c);
    return result;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur IA', clusters: [] };
  }
}

// ── 4. Family narrative ───────────────────────────────────────────────────────

export async function familyNarrative(
  rootPerson: Individual,
  individuals: Map<string, Individual>,
  families: Map<string, Family>,
  generations = 4,
): Promise<string> {
  const c = readCache<string>(CACHE_KEYS.narrative);
  const key = `${rootPerson.id}-${generations}`;
  if (c[key]) return c[key];

  const lineage: Array<{ gen: number; name: string; sex: string; birth: string; death: string | undefined; occupation: string }> = [];

  function visit(personId: string, gen: number) {
    if (!personId || gen > generations) return;
    const p = individuals.get(personId);
    if (!p) return;
    lineage.push({
      gen,
      name: p.name?.display ?? '',
      sex: p.sex,
      birth: (p.birth?.date?.display ?? '') + (p.birth?.place ? ' à ' + p.birth.place : ''),
      death: p.death?.date?.display,
      occupation: p.occupation,
    });
    const fam = p.famc?.[0] ? families.get(p.famc[0]) : null;
    if (!fam) return;
    if (fam.husband) visit(fam.husband, gen + 1);
    if (fam.wife) visit(fam.wife, gen + 1);
  }
  visit(rootPerson.id, 0);

  const prompt = `Tu es un historien rédigeant un récit familial en français, ton sobre et factuel. Écris un texte continu de 8 à 12 phrases retraçant la lignée ascendante de ${rootPerson.name?.display}, du plus ancien au plus récent. Mentionne les époques, lieux et professions quand ils sont fournis. Ne jamais inventer de fait.

Lignée : ${JSON.stringify(lineage, null, 2)}

RÉCIT :`;

  try {
    const text = await aiCall(prompt);
    const clean = (text || '').trim();
    c[key] = clean;
    writeCache(CACHE_KEYS.narrative, c);
    return clean;
  } catch (e) {
    return `Erreur : ${e instanceof Error ? e.message : 'IA indisponible'}`;
  }
}

// ── 5. Short bio ──────────────────────────────────────────────────────────────

export async function shortBio(person: Individual): Promise<string | null> {
  const c = readCache<string>(CACHE_KEYS.shortBios);
  if (c[person.id]) return c[person.id];

  const facts = [
    `Nom : ${person.name?.display}`,
    person.birth?.date?.year ? `Né${person.sex === 'F' ? 'e' : ''} en ${person.birth.date.year}${person.birth?.place ? ' à ' + person.birth.place : ''}` : null,
    person.death?.date?.year ? `Décédé${person.sex === 'F' ? 'e' : ''} en ${person.death.date.year}${person.death?.place ? ' à ' + person.death.place : ''}` : null,
    person.occupation ? `Profession : ${person.occupation}` : null,
  ].filter(Boolean);

  const prompt = `Rédige une bio en UNE SEULE phrase française (≤ 25 mots, sans markdown, sans guillemets) qui résume cette personne.

Faits :
${facts.join('\n')}

Réponds uniquement par la phrase, rien d'autre.`;

  try {
    const text = await aiCall(prompt);
    const clean = (text || '').trim().replace(/^["'«"]/, '').replace(/["'»"]$/, '');
    c[person.id] = clean;
    writeCache(CACHE_KEYS.shortBios, c);
    return clean;
  } catch { return null; }
}

export function getCachedShortBio(personId: string): string | null {
  const c = readCache<string>(CACHE_KEYS.shortBios);
  return c[personId] || null;
}

// ── 6. Natural-language query ─────────────────────────────────────────────────

export async function naturalQuery(
  text: string,
  individuals: Map<string, Individual>,
): Promise<NaturalQueryFilter | null> {
  if (!text?.trim()) return null;

  const sample = Array.from(individuals.values()).slice(0, 6).map((p) => ({
    id: p.id, name: p.name?.display, sex: p.sex,
    birthYear: p.birth?.date?.year, birthPlace: p.birth?.place,
    occupation: p.occupation,
  }));

  const prompt = `Tu convertis une requête généalogique en français en filtre JSON.

Schéma : { name, sex (M/F), birthYear, birthPlace, deathYear, deathPlace, occupation }

Exemples de fiches : ${JSON.stringify(sample, null, 2)}

Requête : """${text}"""

Réponds STRICTEMENT en JSON, sans markdown :
{
  "sex": "M" | "F" | null,
  "surnamePattern": "..." | null,
  "placePattern": "..." | null,
  "yearMin": 1700 | null,
  "yearMax": 1799 | null,
  "occupationPattern": "..." | null,
  "explanation": "courte description française de ce qui sera filtré"
}`;

  try {
    const raw = await aiCall(prompt);
    return parseJson<NaturalQueryFilter>(raw);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur d'analyse", explanation: '' };
  }
}

const REGIONS: Record<string, string[]> = {
  'bretagne': ['côtes', 'finistère', 'morbihan', 'ille-et-vilaine'],
  'normandie': ['calvados', 'manche', 'orne', 'eure', 'seine-maritime'],
  'alsace': ['bas-rhin', 'haut-rhin'],
  'lorraine': ['meurthe-et-moselle', 'meuse', 'moselle', 'vosges'],
  'île-de-france': ['paris', 'yvelines', 'essonne', 'hauts-de-seine', 'seine-saint-denis', 'val-de-marne', "val-d'oise", 'seine-et-marne'],
  'provence': ['bouches-du-rhône', 'var', 'vaucluse', 'alpes-de-haute-provence', 'alpes-maritimes'],
  'pays de la loire': ['loire-atlantique', 'maine-et-loire', 'sarthe', 'mayenne', 'vendée'],
};

export function applyQuery(query: NaturalQueryFilter, individuals: Map<string, Individual>): Individual[] {
  if (!query || query.error) return [];
  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const placeQ = query.placePattern ? norm(query.placePattern) : null;
  const placeAliases = placeQ && REGIONS[placeQ] ? REGIONS[placeQ].map(norm) : null;
  const surnameQ = query.surnamePattern ? norm(query.surnamePattern) : null;
  const occQ = query.occupationPattern ? norm(query.occupationPattern) : null;

  const out: Individual[] = [];
  for (const p of individuals.values()) {
    if (query.sex && p.sex !== query.sex) continue;
    if (surnameQ && !norm(p.name?.surname || p.name?.display || '').includes(surnameQ)) continue;
    const py = p.birth?.date?.year;
    if (query.yearMin && (!py || py < query.yearMin)) continue;
    if (query.yearMax && (!py || py > query.yearMax)) continue;
    if (occQ && !norm(p.occupation || '').includes(occQ)) continue;
    if (placeQ) {
      const bp = norm(p.birth?.place || '');
      const dp = norm(p.death?.place || '');
      const matchesDirect = bp.includes(placeQ) || dp.includes(placeQ);
      const matchesAlias = placeAliases?.some((a) => bp.includes(a) || dp.includes(a)) ?? false;
      if (!matchesDirect && !matchesAlias) continue;
    }
    out.push(p);
  }
  return out;
}

// ── 7. Wikipedia cross-check ──────────────────────────────────────────────────

export async function wikipediaCheck(person: Individual): Promise<WikipediaCheckResult> {
  const name = person.name?.display;
  if (!name) return { wiki: null, error: 'Nom manquant' };

  let wiki: WikipediaEntry[] | null = null;
  try {
    const res = await fetch(
      `https://fr.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(name)}&limit=5&format=json&origin=*`,
    );
    if (res.ok) {
      const data = await res.json() as [string, string[], string[], string[]];
      const [, titles, descs, urls] = data;
      wiki = (titles || []).map((t, i) => ({ title: t, desc: descs[i] || '', url: urls[i] || '' }));
    }
  } catch { /* ignore */ }

  const facts = {
    name,
    birthYear: person.birth?.date?.year,
    birthPlace: person.birth?.place,
    deathYear: person.death?.date?.year,
    deathPlace: person.death?.place,
    occupation: person.occupation,
  };

  const prompt = `Tu analyses la plausibilité historique d'une fiche généalogique.

Fiche : ${JSON.stringify(facts, null, 2)}

Résultats Wikipedia (recherche de "${name}") : ${JSON.stringify(wiki?.slice(0, 3) || [], null, 2)}

Réponds STRICTEMENT en JSON, sans markdown :
{
  "matches": [{ "title": "...", "likelyMatch": true|false, "reason": "..." }],
  "plausibilityNotes": "observations sur la cohérence historique",
  "redFlags": ["alertes éventuelles…"]
}`;

  try {
    const raw = await aiCall(prompt);
    const analysis = parseJson<WikipediaCheckResult['analysis']>(raw);
    return { wiki, analysis };
  } catch (e) {
    return { wiki, error: e instanceof Error ? e.message : "Erreur d'analyse" };
  }
}

// ── 8. OCR from scanned act ───────────────────────────────────────────────────

export async function extractActFromImage(imageBase64: string, mimeType?: string): Promise<OcrResult> {
  const prompt = `Tu analyses l'image d'un acte d'état civil français (souvent manuscrit, ancien).

Extrais les informations clés. Si l'image n'est pas un acte ou est illisible, indique-le dans "notes" et mets confidence à 0.

Réponds STRICTEMENT en JSON, sans markdown :
{
  "actType": "naissance" | "mariage" | "décès" | "autre" | null,
  "date": "date lisible telle qu'écrite" | null,
  "place": "lieu (commune, paroisse)" | null,
  "principal": { "given": "...", "surname": "...", "age": "...", "profession": "..." } | null,
  "parents": [{ "given": "...", "surname": "...", "role": "père" | "mère" }],
  "spouse": { "given": "...", "surname": "..." } | null,
  "witnesses": ["..."],
  "notes": "observations libres",
  "confidence": 0-100
}`;

  try {
    const raw = await aiCallMultimodal({ prompt, image: imageBase64, mimeType });
    return parseJson<OcrResult>(raw);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur d'extraction" };
  }
}
