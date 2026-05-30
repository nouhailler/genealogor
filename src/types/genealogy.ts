// ═══════════════════════════════════════════════════════════════════════════
// Core domain types for Genealogor.
// Covers: GEDCOM data model, application state, view contracts, UI features.
// ═══════════════════════════════════════════════════════════════════════════

// ── Type aliases ─────────────────────────────────────────────────────────────

/** GEDCOM cross-reference ID, e.g. "@I42@" */
export type PersonId = string;
/** GEDCOM family ID, e.g. "@F7@" */
export type FamilyId = string;
/** Sosa-Stradonitz number (root = 1, father = 2n, mother = 2n+1) */
export type SosaNumber = number;
/** Sosa number → person ID, built by the ancestors walk */
export type SosaMap = Map<SosaNumber, PersonId>;
/** Person ID → Aboville code ("1.2.3"), built by Descendance.computeAboville */
export type AbovilleMap = Map<PersonId, string>;

// ── GEDCOM data model ────────────────────────────────────────────────────────

export interface GDate {
  raw: string;
  year: number | null;
  month: number | null;
  day: number | null;
  display: string;
}

export interface GEvent {
  date: GDate;
  place: string;
}

export interface IndividualName {
  given: string;
  surname: string;
  suffix?: string;
  display: string;
}

export interface Individual {
  id: PersonId;
  name: IndividualName;
  sex: 'M' | 'F' | 'U';
  birth: GEvent | null;
  death: GEvent | null;
  occupation: string;
  note: string;
  /** IDs of families where this person appears as a child (parents) */
  famc: FamilyId[];
  /** IDs of families where this person appears as a spouse */
  fams: FamilyId[];
}

export interface Family {
  id: FamilyId;
  husband: PersonId | null;
  wife: PersonId | null;
  children: PersonId[];
  marriage: GEvent | null;
}

export interface ParseError {
  line?: number;
  message: string;
}

export interface GenealogyData {
  individuals: Map<PersonId, Individual>;
  families: Map<FamilyId, Family>;
  errors: ParseError[];
}

// ── Application state ────────────────────────────────────────────────────────

/** One loaded file (GEDCOM or CSV). Multiple datasets are merged at display time. */
export interface Dataset extends GenealogyData {
  fileName: string;
  /** 2-3 char prefix used to namespace IDs when merging multiple files */
  prefix: string;
  /** Raw file text, kept for localStorage persistence across sessions */
  rawText?: string;
}

/** State encoded in the URL for stable permalinks.
 *  Maps to: ?person=…&tab=…&q=…&ft=1&fav=1&adv={json}
 */
export interface PermalinkState {
  person: PersonId | null;
  tab: TabId;
  q: string;
  fullText: boolean;
  showFavOnly: boolean;
  advFilters: AdvancedFilter | null;
}

export type TabId =
  | 'profile'
  | 'ancestors'
  | 'descendants'
  | 'timeline'
  | 'map'
  | 'stats'
  | 'graph'
  | 'compare'
  | 'implex'
  | 'validation'
  | 'media'
  | 'ai'
  | 'places';

export type AncestorMode = 'fan' | 'pedigree' | 'hourglass';

// ── View component contract ──────────────────────────────────────────────────

/** Common props shared by every view component. */
export interface ViewProps {
  person: Individual;
  data: GenealogyData;
  onNavigate: (id: PersonId) => void;
  isPrivate: (p: Individual | null | undefined) => boolean;
}

// ── Settings ─────────────────────────────────────────────────────────────────

export type AiProvider = 'claude' | 'openrouter' | 'ollama' | 'none';

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  privacyEnabled: boolean;
  privacyThresholdYears: number;
  aiProvider: AiProvider;
  aiModel: string;
  aiApiKey: string;
  aiEndpoint: string;
}

// ── Advanced search / filtering ───────────────────────────────────────────────

export interface AdvancedFilter {
  sex?: 'M' | 'F' | 'U';
  birthYearMin?: number;
  birthYearMax?: number;
  deathYearMin?: number;
  deathYearMax?: number;
  birthPlace?: string;
  occupation?: string;
  hasNote?: boolean;
  livingOnly?: boolean;
  deceasedOnly?: boolean;
  surnameExact?: string;
  /** Free-form NL query from the AI natural-language search */
  nlQuery?: string;
}

// ── Validation (ValidationView) ───────────────────────────────────────────────

export type ValidationErrorKind =
  | 'birth-after-death'       // birth year > death year
  | 'parent-born-after-child' // parent born after their child
  | 'parent-loop'             // cycle in the ancestor graph
  | 'duplicate-name'          // two individuals with identical name+birth
  | 'missing-birth'           // no birth event at all
  | 'missing-death'           // no death event for person born >150 years ago
  | 'lifespan-too-long'       // lifespan > 120 years
  | 'child-before-marriage'   // child born before parents' marriage
  | 'too-many-parents';       // individual appears in more than one FAMC

export interface ValidationError {
  kind: ValidationErrorKind;
  severity: 'error' | 'warning' | 'info';
  message: string;
  personIds: PersonId[];
}

export interface ValidationResult {
  errors: ValidationError[];
  /** % of individuals with at least a birth year */
  completenessScore: number;
  /** % of individuals with both birth and death */
  fullCompleteness: number;
  totalIndividuals: number;
  totalFamilies: number;
}

// ── Statistics (StatsView / AgePyramid) ───────────────────────────────────────

export interface StatsAggregates {
  totalIndividuals: number;
  totalFamilies: number;
  sexDistribution: { M: number; F: number; U: number };
  /** Average lifespan of individuals with both birth and death years */
  avgLifespan: number | null;
  /** Oldest recorded individual */
  longestLived: { person: Individual; years: number } | null;
  /** Surnname → count, sorted desc */
  topSurnames: Array<{ surname: string; count: number }>;
  /** Place → count for birth places */
  topBirthPlaces: Array<{ place: string; count: number }>;
  /** Decade → { M: count, F: count } for births */
  birthsByDecade: Array<{ decade: number; M: number; F: number }>;
  /** Decade → { M: count, F: count } for deaths */
  deathsByDecade: Array<{ decade: number; M: number; F: number }>;
  /** For AgePyramid: age bucket (0-9, 10-19 …) → { M, F } at death */
  agePyramid: Array<{ ageBucket: number; M: number; F: number }>;
  /** Cohort life expectancy by decade of birth */
  cohortLifeExpectancy: Array<{
    decade: number;
    avgAll: number | null;
    avgM: number | null;
    avgF: number | null;
  }>;
}

// ── Geography (GeoMapView / PlacesView) ──────────────────────────────────────

export interface GeocodedPlace {
  originalPlace: string;
  /** Canonical key used for deduplication */
  normalizedPlace: string;
  lat: number;
  lon: number;
  /** INSEE département code if resolvable */
  deptCode: string | null;
  /** Number of times this place appears across all events */
  count: number;
  /** IDs of individuals born/married/died here */
  personIds: PersonId[];
}

/** Subset of the Nominatim /search JSON response */
export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}

export type MapMode = 'points' | 'migrations' | 'heatmap' | 'surnames';

// ── AI features (AiLabView) ───────────────────────────────────────────────────

export interface AiCacheEntry<T = unknown> {
  result: T;
  cachedAt: number;
  model: string;
}

export interface NaturalQueryResult {
  filter: AdvancedFilter;
  explanation: string;
}

export interface WikipediaVerification {
  personId: PersonId;
  found: boolean;
  url: string | null;
  plausible: boolean | null;
  note: string;
}

// ── Duplicate detection / Merge (MergeModal) ─────────────────────────────────

export interface DuplicateCandidate {
  personA: Individual;
  personB: Individual;
  /** 0–1 confidence score */
  score: number;
  reasons: string[];
}

export type MergeFieldChoice = 'A' | 'B' | 'both';

export interface MergePlan {
  keepId: PersonId;
  removeId: PersonId;
  fieldChoices: Partial<Record<keyof Individual, MergeFieldChoice>>;
}
