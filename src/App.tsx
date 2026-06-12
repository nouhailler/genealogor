import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { Dataset, Family, GenealogyData, Individual, TabId } from '@/types/genealogy';
import { parse as parseGedcom } from '@/lib/gedcom-parser';
import { importCSV } from '@/lib/csv-importer';
import { serialize } from '@/lib/gedcom-serializer';
import { usePrivacy, shouldMask } from '@/lib/privacy';
import { useFavorites, useRecentlyViewed, clearFavorites, clearRecent, haptic } from '@/lib/favorites';
import { search as ftSearch } from '@/lib/fulltext-search';
import { Icon } from '@/components/ui-kit';
import AdvancedSearch from '@/components/AdvancedSearch';
import { type SearchFilter, EMPTY_FILTER, applyAdvancedFilter, exportCSV, exportGEDCOM } from '@/lib/advanced-filter';
import UploadZone from '@/components/UploadZone';
import HelpPanel from '@/components/HelpPanel';
import { MobileBottomNav, MobileMoreSheet } from '@/components/mobile/MobileShell';
import type { PrimaryMobileTab } from '@/components/mobile/mobile-tabs';
import { Onboarding, PwaInstallBanner } from '@/components/mobile/MobileOnboarding';
import { useOnboarding } from '@/lib/onboarding';
import ProfileView from '@/components/views/ProfileView';
import AncestorsView from '@/components/views/AncestorsView';
import DescendantsView from '@/components/views/DescendantsView';
import ImplexView from '@/components/views/ImplexView';
import CompareView from '@/components/views/CompareView';
import ForceGraphView from '@/components/views/ForceGraphView';
import TimelineView from '@/components/views/TimelineView';
import PlacesView from '@/components/views/PlacesView';
import GeoMapView from '@/components/views/GeoMapView';
import StatsView from '@/components/views/StatsView';
import ValidationView from '@/components/views/ValidationView';
import AiLabView from '@/components/views/AiLabView';
import MediaGallery from '@/components/views/MediaGallery';
import SettingsPanel from '@/components/views/SettingsPanel';
import PassphraseScreen from '@/components/PassphraseScreen';
import { CinematicOverlay } from '@/components/CinematicDemo';
import type { DemoCallbacks } from '@/components/CinematicDemo';

const STORAGE_KEYS = {
  DATASETS:    'genealogor.savedDatasets',
  SELECTED_ID: 'genealogor.selectedId',
  ACTIVE_TAB:  'genealogor.activeTab',
} as const;

interface SavedDataset { fileName: string; prefix: string; text: string; }

const TABS: { id: TabId; label: string }[] = [
  { id: 'profile',     label: 'Profil'       },
  { id: 'ancestors',   label: 'Ascendants'   },
  { id: 'descendants', label: 'Descendants'  },
  { id: 'implex',      label: 'Implications' },
  { id: 'compare',     label: 'Comparer'     },
  { id: 'graph',       label: 'Graphe'       },
  { id: 'timeline',    label: 'Frise'        },
  { id: 'places',      label: 'Lieux'        },
  { id: 'map',         label: 'Carte'        },
  { id: 'media',       label: 'Médias'       },
  { id: 'stats',       label: 'Stats'        },
  { id: 'validation',  label: 'Qualité'      },
  { id: 'ai',          label: 'IA'           },
];

function mergeDatasets(datasets: Dataset[]): GenealogyData {
  const individuals = new Map<string, Individual>();
  const families = new Map<string, Family>();
  const errors: GenealogyData['errors'] = [];
  for (const ds of datasets) {
    ds.individuals.forEach((v, k) => individuals.set(k, v));
    ds.families.forEach((v, k) => families.set(k, v));
    errors.push(...ds.errors);
  }
  return { individuals, families, errors };
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return mobile;
}

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [showOnboarding, doneOnboarding] = useOnboarding();
  const [advFilter, setAdvFilter] = useState<SearchFilter>(EMPTY_FILTER);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return (localStorage.getItem('genealogor.theme') as 'light' | 'dark') || 'light'; } catch { return 'light'; }
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('genealogor.theme', theme); } catch { /* ignore */ }
  }, [theme]);

  const [restoring, setRestoring] = useState(() => {
    try { return !!localStorage.getItem(STORAGE_KEYS.DATASETS); } catch { return false; }
  });
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  // Preloaded-dataset state (URL param ?dataset=demo|famille)
  const datasetParam = useMemo(() => new URLSearchParams(window.location.search).get('dataset') ?? '', []);
  const [encryptedBuffer, setEncryptedBuffer] = useState<ArrayBuffer | null>(null);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [passphraseError, setPassphraseError] = useState<string | null>(null);
  const [passphraseLoading, setPassphraseLoading] = useState(false);

  const merged = useMemo(() => mergeDatasets(datasets), [datasets]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    try { return (localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) as TabId) || 'profile'; } catch { return 'profile'; }
  });
  const [query, setQuery] = useState('');
  const [useFullText, setUseFullText] = useState(false);
  const [favOnly, setFavOnly] = useState(false);

  const { favorites, isFav, toggleFav } = useFavorites();
  const { recent, push: pushRecent } = useRecentlyViewed();

  const navStack = useRef<string[]>([]);
  const navIdx = useRef(-1);
  const [, setNavTick] = useState(0);

  // Restore session from localStorage on first mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DATASETS);
      if (!raw) { setRestoring(false); return; }
      const saved: SavedDataset[] = JSON.parse(raw);
      const newDatasets: Dataset[] = saved.map(({ fileName, prefix, text }) => {
        const isGed = /\.(ged|gedcom)$/i.test(fileName);
        const data = isGed ? parseGedcom(text) : importCSV(text);
        return { ...data, fileName, prefix, rawText: text };
      });
      setDatasets(newDatasets);
      const m = mergeDatasets(newDatasets);
      const savedId = localStorage.getItem(STORAGE_KEYS.SELECTED_ID);
      const idToRestore = savedId && m.individuals.has(savedId)
        ? savedId
        : Array.from(m.individuals.keys())[0] ?? null;
      if (idToRestore) {
        setSelectedId(idToRestore);
        navStack.current = [idToRestore];
        navIdx.current = 0;
      }
    } catch { /* ignore corrupted data */ }
    setRestoring(false);
  }, []);  

  // Auto-load preloaded datasets from URL param ?dataset=demo|famille
  // Runs only once, after session restore, and only if no session was restored.
  useEffect(() => {
    if (restoring) return;                 // wait for restore to finish
    if (datasets.length > 0) return;       // session already loaded — skip
    if (!datasetParam) return;             // no URL param — skip

    if (datasetParam === 'demo') {
      setParsing(true);
      fetch('/data/demo.ged')
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        })
        .then(text => {
          const data = parseGedcom(text);
          setDatasets([{ ...data, fileName: 'demo.ged', prefix: 'DMO', rawText: text }]);
          const firstId = Array.from(data.individuals.keys())[0];
          if (firstId) { navStack.current = [firstId]; navIdx.current = 0; setSelectedId(firstId); }
        })
        .catch(err => setParseErrors([`Impossible de charger demo.ged : ${err.message}`]))
        .finally(() => setParsing(false));
    } else if (datasetParam === 'famille') {
      fetch('/data/famille.ged.enc')
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.arrayBuffer();
        })
        .then(buf => { setEncryptedBuffer(buf); setShowPassphrase(true); })
        .catch(err => setParseErrors([`Impossible de charger famille.ged.enc : ${err.message}`]));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoring]);

  // Persist datasets whenever they change
  useEffect(() => {
    if (restoring) return;
    try {
      if (datasets.length === 0) { localStorage.removeItem(STORAGE_KEYS.DATASETS); return; }
      const toSave: SavedDataset[] = datasets
        .filter(d => d.rawText)
        .map(d => ({ fileName: d.fileName, prefix: d.prefix, text: d.rawText! }));
      if (toSave.length > 0) localStorage.setItem(STORAGE_KEYS.DATASETS, JSON.stringify(toSave));
    } catch { /* quota exceeded — skip */ }
  }, [datasets, restoring]);

  // Persist selected person
  useEffect(() => {
    if (restoring || !selectedId) return;
    try { localStorage.setItem(STORAGE_KEYS.SELECTED_ID, selectedId); } catch { /* ignore */ }
  }, [selectedId, restoring]);

  // Persist active tab
  useEffect(() => {
    if (restoring) return;
    try { localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTab); } catch { /* ignore */ }
  }, [activeTab, restoring]);

  // Apply permalink params once data is loaded (URL takes priority over the
  // restored localStorage session) — see PermalinkState in types/genealogy.ts
  // Snapshot taken at mount: the URL-sync effect below rewrites the URL before
  // data finishes loading, so reading window.location here would be too late.
  const initialUrlParams = useRef(new URLSearchParams(window.location.search));
  const permalinkApplied = useRef(false);
  useEffect(() => {
    if (restoring || datasets.length === 0 || permalinkApplied.current) return;
    permalinkApplied.current = true;
    const params = initialUrlParams.current;
    const person = params.get('person');
    if (person && merged.individuals.has(person)) {
      navStack.current = [person];
      navIdx.current = 0;
      setSelectedId(person);
    }
    const tab = params.get('tab');
    if (tab && TABS.some((t) => t.id === tab)) setActiveTab(tab as TabId);
    const q = params.get('q');
    if (q) setQuery(q);
    if (params.get('ft') === '1') setUseFullText(true);
    if (params.get('fav') === '1') setFavOnly(true);
    const adv = params.get('adv');
    if (adv) {
      try { setAdvFilter((prev) => ({ ...prev, ...JSON.parse(adv) })); } catch { /* malformed — ignore */ }
    }
  }, [restoring, datasets.length, merged.individuals]);

  // Keep the URL in sync so the current view is a stable shareable link
  useEffect(() => {
    if (restoring) return;
    const params = new URLSearchParams();
    if (datasetParam) params.set('dataset', datasetParam);
    if (datasets.length > 0) {
      if (selectedId) params.set('person', selectedId);
      if (activeTab !== 'profile') params.set('tab', activeTab);
      if (query.trim()) params.set('q', query.trim());
      if (useFullText) params.set('ft', '1');
      if (favOnly) params.set('fav', '1');
      const advActive = Object.fromEntries(Object.entries(advFilter).filter(([, v]) => v));
      if (Object.keys(advActive).length > 0) params.set('adv', JSON.stringify(advActive));
    }
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [restoring, datasets.length, selectedId, activeTab, query, useFullText, favOnly, advFilter, datasetParam]);

  const navigateTo = useCallback((id: string) => {
    if (!id) return;
    pushRecent(id);
    const stack = navStack.current;
    const idx = navIdx.current;
    if (stack[idx] === id) { setSelectedId(id); return; }
    navStack.current = [...stack.slice(0, idx + 1), id];
    navIdx.current = navStack.current.length - 1;
    setSelectedId(id);
    setNavTick((t) => t + 1);
  }, [pushRecent]);

  const navUndo = useCallback(() => {
    if (navIdx.current <= 0) return;
    navIdx.current -= 1;
    setSelectedId(navStack.current[navIdx.current]);
    setNavTick((t) => t + 1);
  }, []);

  const navRedo = useCallback(() => {
    if (navIdx.current >= navStack.current.length - 1) return;
    navIdx.current += 1;
    setSelectedId(navStack.current[navIdx.current]);
    setNavTick((t) => t + 1);
  }, []);

  const canUndo = navIdx.current > 0;
  const canRedo = navIdx.current < navStack.current.length - 1;

  const [privacy] = usePrivacy();
  const isPrivate = useCallback(
    (p: Individual | null | undefined) => shouldMask(p, privacy),
    [privacy],
  );

  const isMobile = useIsMobile();
  const [mobilePane, setMobilePane] = useState<'list' | 'profile'>('list');
  const mobileFileRef = useRef<HTMLInputElement>(null);

  const handlePickPrimary = useCallback((id: PrimaryMobileTab) => {
    if (id === 'liste') {
      setMobilePane('list');
    } else {
      setActiveTab(id as TabId);
      setMobilePane('profile');
    }
  }, []);

  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName?.toLowerCase();
      const inField = tag === 'input' || tag === 'textarea' || (e.target as HTMLElement).isContentEditable;
      if (!inField && (e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey)))) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (!inField && e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); navUndo(); }
      if (!inField && e.altKey && e.key === 'ArrowRight') { e.preventDefault(); navRedo(); }
      if (!inField && e.key === '?') { e.preventDefault(); setShowHelp(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navUndo, navRedo]);

  const loadFiles = useCallback(async (files: File[]) => {
    setParsing(true);
    setParseErrors([]);
    const newDatasets: Dataset[] = [];
    for (const file of files) {
      const text = await file.text();
      const isGed = /\.(ged|gedcom)$/i.test(file.name);
      const data = isGed ? parseGedcom(text) : importCSV(text);
      const prefix = file.name.replace(/\.(ged|gedcom|csv)$/i, '').slice(0, 3).toUpperCase();
      newDatasets.push({ ...data, fileName: file.name, prefix, rawText: text });
      if (data.errors.length > 0) {
        setParseErrors((prev) => [...prev, ...data.errors.map((e: { message: string }) => `${file.name}: ${e.message}`)]);
      }
    }
    setDatasets((prev) => [...prev, ...newDatasets]);
    setParsing(false);
    if (newDatasets.length > 0) {
      const firstId = Array.from(newDatasets[0].individuals.keys())[0];
      if (firstId) navigateTo(firstId);
    }
  }, [navigateTo]);

  const loadSample = useCallback(async () => {
    setParsing(true);
    try {
      const { SAMPLE_GED } = await import('@/lib/sample-ged');
      const data = parseGedcom(SAMPLE_GED);
      setDatasets([{ ...data, fileName: 'sample.ged', prefix: 'SAM', rawText: SAMPLE_GED }]);
      const firstId = Array.from(data.individuals.keys())[0];
      if (firstId) navigateTo(firstId);
    } catch {
      setParseErrors(["Impossible de charger les données d'exemple."]);
    }
    setParsing(false);
  }, [navigateTo]);

  const handleDecrypt = useCallback(async (passphrase: string) => {
    if (!encryptedBuffer) return;
    setPassphraseLoading(true);
    setPassphraseError(null);
    try {
      const enc = new TextEncoder();
      const salt       = encryptedBuffer.slice(0, 16);
      const iv         = encryptedBuffer.slice(16, 28);
      const ciphertext = encryptedBuffer.slice(28);
      const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'],
      );
      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', hash: 'SHA-256', iterations: 250_000, salt },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt'],
      );
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
      const gedText = new TextDecoder().decode(decrypted);
      const data = parseGedcom(gedText);
      setDatasets([{ ...data, fileName: 'famille.ged', prefix: 'FAM', rawText: gedText }]);
      const firstId = Array.from(data.individuals.keys())[0];
      if (firstId) { navStack.current = [firstId]; navIdx.current = 0; setSelectedId(firstId); }
      setShowPassphrase(false);
      setEncryptedBuffer(null);
    } catch {
      setPassphraseError('Phrase secrète incorrecte. Veuillez réessayer.');
    } finally {
      setPassphraseLoading(false);
    }
  }, [encryptedBuffer]);

  const handleEditPerson = useCallback((updated: Individual) => {
    setDatasets(prev => prev.map(ds => {
      if (!ds.individuals.has(updated.id)) return ds;
      const individuals = new Map(ds.individuals);
      individuals.set(updated.id, updated);
      const rawText = serialize(individuals, ds.families);
      return { ...ds, individuals, rawText };
    }));
  }, []);

  const filteredIndividuals = useMemo(() => {
    const all = Array.from(merged.individuals.values());
    let base: Individual[];
    if (!query.trim()) {
      base = all;
    } else if (useFullText) {
      base = ftSearch(query, merged.individuals).map((r: { person: Individual }) => r.person).filter(Boolean) as Individual[];
    } else {
      const q = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      base = all.filter((p) => {
        const name = p.name.display.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        return name.includes(q);
      });
    }
    const result = applyAdvancedFilter(base, '', advFilter);
    return favOnly ? result.filter((p) => favorites.has(p.id)) : result;
  }, [merged.individuals, query, useFullText, advFilter, favOnly, favorites]);

  const selectedPerson = selectedId ? merged.individuals.get(selectedId) ?? null : null;

  const favoritePersons = useMemo(
    () => Array.from(favorites).map((id) => merged.individuals.get(id)).filter(Boolean) as Individual[],
    [favorites, merged.individuals],
  );
  const recentPersons = useMemo(
    () => recent.map((id) => merged.individuals.get(id)).filter(Boolean) as Individual[],
    [recent, merged.individuals],
  );

  const filteredIdsRef = useRef(filteredIndividuals);
  filteredIdsRef.current = filteredIndividuals;

  const demoCallbacks = useMemo<DemoCallbacks>(() => ({
    navigateTo,
    setActiveTab,
    getPersonIds: () => filteredIdsRef.current.map(p => p.id),
  }), [navigateTo, setActiveTab]);  

  // Passphrase screen for ?dataset=famille
  if (showPassphrase) {
    return (
      <PassphraseScreen
        onDecrypt={handleDecrypt}
        onCancel={() => { setShowPassphrase(false); setEncryptedBuffer(null); setPassphraseError(null); }}
        error={passphraseError}
        loading={passphraseLoading}
      />
    );
  }

  // Upload screen
  if (datasets.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] px-4 py-12">
        <header className="mb-10 text-center">
          <h1 className="text-2xl font-semibold text-[var(--ink)] tracking-tight">Genealogor</h1>
          <p className="text-sm text-[var(--ink-muted)] mt-1">Visualiseur GEDCOM offline-first</p>
        </header>
        {(parsing || restoring) ? (
          <div className="text-[var(--ink-muted)] text-sm flex items-center gap-2">
            <span className="inline-block size-4 border-2 border-[var(--accent)] border-t-transparent rounded-full" style={{ animation: 'spin 0.8s linear infinite' }} />
            {restoring ? 'Restauration…' : 'Chargement…'}
          </div>
        ) : (
          <UploadZone onFiles={loadFiles} onLoadSample={loadSample} />
        )}
        {parseErrors.length > 0 && (
          <div className="mt-6 max-w-lg w-full rounded-md border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
            {parseErrors.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        )}
      </div>
    );
  }

  // Main layout
  return (
    <div className="flex flex-col h-full bg-[var(--bg)]">
      {/* Header */}
      <header className="flex items-center gap-2 px-3 h-12 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
        <span className="font-semibold text-sm text-[var(--ink)] mr-1 hidden sm:block">Genealogor</span>

        <div className="flex-1 relative max-w-sm">
          <input
            ref={searchInputRef}
            data-demo-id="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher… (/)"
            className="w-full h-8 pl-3 pr-7 rounded-md bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)]"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] hover:text-[var(--ink)] text-sm leading-none">×</button>
          )}
        </div>

        <button
          onClick={() => setUseFullText((v) => !v)}
          className={`h-7 px-2 rounded text-xs font-mono transition-colors ${useFullText ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--ink-faint)] hover:text-[var(--ink)]'}`}
          title="Basculer recherche plein texte"
        >FT</button>

        <div className="flex-1" />

        <button disabled={!canUndo} onClick={navUndo} className="h-7 px-1.5 rounded text-[var(--ink-muted)] hover:text-[var(--ink)] disabled:opacity-30 text-sm" title="Précédent Alt+←">←</button>
        <button disabled={!canRedo} onClick={navRedo} className="h-7 px-1.5 rounded text-[var(--ink-muted)] hover:text-[var(--ink)] disabled:opacity-30 text-sm" title="Suivant Alt+→">→</button>

        <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="h-7 w-7 grid place-items-center rounded text-[var(--ink-muted)] hover:text-[var(--ink)]" title="Thème">
          {theme === 'light' ? <Icon.Moon className="size-4" /> : <Icon.Sun className="size-4" />}
        </button>

        <label className="h-7 w-7 grid place-items-center rounded cursor-pointer text-[var(--ink-muted)] hover:text-[var(--ink)]" title="Ajouter fichier">
          <input type="file" accept=".ged,.gedcom,.csv" multiple className="hidden" onChange={(e) => { if (e.target.files) loadFiles(Array.from(e.target.files)); }} />
          <Icon.Plus className="size-4" />
        </label>

        {datasets.length > 0 && (
          <button
            onClick={() => setDemoRunning(v => !v)}
            title={demoRunning ? 'Arrêter la démo cinématique' : 'Lancer la démo cinématique'}
            className="h-7 w-7 grid place-items-center rounded text-base leading-none transition-colors"
            style={{ color: demoRunning ? '#f59e0b' : 'var(--ink-faint)' }}
          >◉</button>
        )}

        <button onClick={() => setShowHelp(true)} className="h-7 w-7 grid place-items-center rounded text-[var(--ink-muted)] hover:text-[var(--ink)]" title="Aide (?)">
          <Icon.Help className="size-4" />
        </button>

        <button onClick={() => setShowSettings(true)} className="h-7 w-7 grid place-items-center rounded text-[var(--ink-muted)] hover:text-[var(--ink)]" title="Paramètres IA">
          <Icon.Settings className="size-4" />
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0 relative">
        {/* List pane — on mobile: absolute over the body area (not the header/bottom-nav) */}
        <aside className={`
          flex flex-col border-r border-[var(--border)] bg-[var(--surface)] shrink-0
          ${isMobile ? (mobilePane === 'list' ? 'w-full absolute inset-0 z-10 flex' : 'hidden') : 'w-64 lg:w-72'}
        `}>
          <div className="px-3 py-1.5 text-[11px] text-[var(--ink-faint)] font-mono border-b border-[var(--border)] flex items-center gap-2">
            <span>{filteredIndividuals.length} individu{filteredIndividuals.length !== 1 ? 's' : ''}</span>
            {query && <span className="truncate">· «{query}»</span>}
            <button
              onClick={() => { setFavOnly((v) => !v); haptic('light'); }}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border transition-colors"
              style={{
                color: favOnly ? 'var(--warn)' : 'var(--ink-faint)',
                borderColor: favOnly ? 'var(--warn)' : 'var(--border)',
                background: favOnly ? 'color-mix(in oklch, var(--warn) 12%, transparent)' : 'transparent',
              }}
              title="Afficher uniquement les favoris"
            >
              <Icon.Star style={{ width: 10, height: 10, fill: favOnly ? 'var(--warn)' : 'none' }} />
              {favorites.size > 0 && <span>{favorites.size}</span>}
            </button>
            {datasets.length > 0 && (
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => exportCSV(merged.individuals)} className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)]" title="Exporter CSV">CSV</button>
                <button onClick={() => exportGEDCOM(merged.individuals, merged.families)} className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)]" title="Exporter GEDCOM">GED</button>
              </div>
            )}
          </div>
          {datasets.length > 0 && (
            <div className="px-3 pb-1 border-b border-[var(--border)]">
              <AdvancedSearch value={advFilter} onChange={setAdvFilter} />
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {filteredIndividuals.map((p, idx) => {
              const masked = isPrivate(p);
              const years = [p.birth?.date?.year, p.death?.date?.year].filter(Boolean);
              return (
                <button
                  key={p.id}
                  data-demo-id={idx < 5 ? `person-${idx}` : undefined}
                  onClick={() => { navigateTo(p.id); if (isMobile) setMobilePane('profile'); }}
                  className={`
                    w-full text-left px-3 py-2.5 border-b border-[var(--border)]/50 transition-colors
                    ${selectedId === p.id ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'hover:bg-[var(--surface-hover)] text-[var(--ink)]'}
                  `}
                >
                  <div className={`text-sm font-medium leading-tight truncate ${masked ? 'is-private' : ''}`}>
                    {isFav(p.id) && <span className="mr-1" style={{ color: 'var(--warn)' }}>★</span>}
                    {p.name.display}
                  </div>
                  <div className="text-[11px] text-[var(--ink-faint)] font-mono mt-0.5 flex items-center gap-1.5">
                    <span className={p.sex === 'M' ? 'text-[var(--sex-m)]' : p.sex === 'F' ? 'text-[var(--sex-f)]' : ''}>
                      {p.sex === 'M' ? '♂' : p.sex === 'F' ? '♀' : '·'}
                    </span>
                    <span className={masked ? 'is-private' : ''}>{years.join('–')}</span>
                    {p.birth?.place && <span className="truncate text-[var(--ink-faint)]">{p.birth.place.split(',')[0]}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Detail pane */}
        <main className={`flex flex-col flex-1 min-w-0 ${isMobile && mobilePane !== 'profile' ? 'hidden' : 'flex'}`}>
          {/* Tab bar — no back button on mobile, bottom nav handles navigation */}
          <div className="flex overflow-x-auto no-scrollbar border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                data-demo-id={`tab-${t.id}`}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-2.5 text-sm shrink-0 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === t.id
                    ? 'border-[var(--accent)] text-[var(--accent)] font-medium'
                    : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'
                }`}
              >{t.label}</button>
            ))}
          </div>

          {/* View */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'media' ? (
              <MediaGallery />
            ) : !selectedPerson ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--ink-muted)]">
                <span className="text-4xl opacity-30">←</span>
                <span className="text-sm">Sélectionnez un individu dans la liste</span>
              </div>
            ) : (
              <ViewRouter tab={activeTab} person={selectedPerson} data={merged} onNavigate={navigateTo} isPrivate={isPrivate} onEditPerson={handleEditPerson} isFav={isFav} onToggleFav={toggleFav} />
            )}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav + more sheet */}
      {isMobile && datasets.length > 0 && (
        <>
          <input ref={mobileFileRef} type="file" accept=".ged,.gedcom,.csv" multiple className="hidden"
            onChange={(e) => { if (e.target.files) void loadFiles(Array.from(e.target.files)); e.target.value = ''; }} />
          <MobileBottomNav
            mobilePane={mobilePane}
            activeTab={activeTab}
            onPickPrimary={handlePickPrimary}
            onOpenMore={() => setShowMore(true)}
          />
          <MobileMoreSheet
            open={showMore}
            onClose={() => setShowMore(false)}
            activeTab={activeTab}
            onPickTab={(tab) => { setActiveTab(tab); setMobilePane('profile'); }}
            theme={theme}
            onTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            onOpenSettings={() => setShowSettings(true)}
            onOpenHelp={() => setShowHelp(true)}
            onReset={() => {
              setDatasets([]); setSelectedId(null); setMobilePane('list'); setFavOnly(false);
              clearFavorites(); clearRecent();
              try { localStorage.removeItem(STORAGE_KEYS.DATASETS); localStorage.removeItem(STORAGE_KEYS.SELECTED_ID); } catch { /* ignore */ }
            }}
            onAddFiles={() => mobileFileRef.current?.click()}
            onSelectPerson={(id) => { navigateTo(id); setMobilePane('profile'); }}
            favoritePersons={favoritePersons}
            recentPersons={recentPersons}
          />
        </>
      )}

      {/* Mobile onboarding (first launch) */}
      {isMobile && showOnboarding && <Onboarding onDone={doneOnboarding} />}
      {isMobile && <PwaInstallBanner />}

      {/* Cinematic demo overlay */}
      {demoRunning && datasets.length > 0 && (
        <CinematicOverlay callbacks={demoCallbacks} onStop={() => setDemoRunning(false)} />
      )}

      {/* Modals */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showHelp && (
        <HelpPanel
          activeTab={datasets.length > 0 ? activeTab : null}
          dataLoaded={datasets.length > 0}
          onClose={() => setShowHelp(false)}
          onOpenSettings={() => { setShowHelp(false); setShowSettings(true); }}
        />
      )}
    </div>
  );
}

interface ViewRouterProps {
  tab: TabId;
  person: Individual;
  data: GenealogyData;
  onNavigate: (id: string) => void;
  isPrivate: (p: Individual | null | undefined) => boolean;
  onEditPerson: (updated: Individual) => void;
  isFav: (id: string) => boolean;
  onToggleFav: (id: string) => void;
}

function ViewRouter({ tab, person, data, onNavigate, onEditPerson, isFav, onToggleFav }: ViewRouterProps) {
  const { individuals, families } = data;

  if (tab === 'profile') {
    return <ProfileView person={person} individuals={individuals} families={families} onSelect={onNavigate} onEditPerson={onEditPerson} isFav={isFav(person.id)} onToggleFav={onToggleFav} />;
  }
  if (tab === 'ancestors') {
    return <AncestorsView person={person} individuals={individuals} families={families} onSelect={onNavigate} />;
  }
  if (tab === 'descendants') {
    return <DescendantsView person={person} individuals={individuals} families={families} onNavigate={onNavigate} />;
  }
  if (tab === 'implex') {
    return <ImplexView person={person} individuals={individuals} families={families} onNavigate={onNavigate} />;
  }
  if (tab === 'compare') {
    return <CompareView person={person} individuals={individuals} families={families} onNavigate={onNavigate} />;
  }
  if (tab === 'graph') {
    return <ForceGraphView individuals={individuals} families={families} onNavigate={onNavigate} focusId={person.id} />;
  }
  if (tab === 'timeline') {
    return <TimelineView individuals={individuals} families={families} onNavigate={onNavigate} />;
  }
  if (tab === 'places') {
    return <PlacesView individuals={individuals} families={families} onNavigate={onNavigate} />;
  }
  if (tab === 'map') {
    return <GeoMapView individuals={individuals} families={families} onNavigate={onNavigate} />;
  }
  if (tab === 'stats') {
    return <StatsView individuals={individuals} families={families} />;
  }
  if (tab === 'validation') {
    return <ValidationView individuals={individuals} families={families} onNavigate={onNavigate} />;
  }
  if (tab === 'ai') {
    return <AiLabView person={person} individuals={individuals} families={families} onNavigate={onNavigate} />;
  }

  return (
    <div className="p-5 sm:p-6 flex flex-col items-center justify-center h-full gap-3 text-[var(--ink-muted)]">
      <span className="text-4xl opacity-30">🚧</span>
      <span className="text-sm">La vue <strong>{tab}</strong> sera disponible prochainement.</span>
    </div>
  );
}
