// AI Lab — natural language search, research suggestions, Wikipedia, archives,
// place normalization, and family narrative.
import { useState } from 'react';
import { Icon, formatVital } from '@/components/ui-kit';
import {
  naturalQuery, applyQuery, researchSuggestions, normalizePlaces,
  familyNarrative, wikipediaCheck,
} from '@/lib/ai-features';
import type {
  NaturalQueryFilter, ResearchSuggestion, PlaceCluster, WikipediaCheckResult,
} from '@/lib/ai-features';
import { linksFor, deptArchives } from '@/lib/archives-templates';
import { extractDept, deptName as getDeptName } from '@/lib/place-gazetteer';
import type { Individual, Family } from '@/types/genealogy';

interface Props {
  person: Individual | null;
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  onNavigate: (id: string) => void;
}

type LabTab = 'ask' | 'research' | 'wikipedia' | 'archives' | 'places' | 'narrative';

// ── Main component ────────────────────────────────────────────────────────────

export default function AiLabView({ person, individuals, families, onNavigate }: Props) {
  const [tab, setTab] = useState<LabTab>('ask');

  // Per-tab state
  const [askText, setAskText] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [askResult, setAskResult] = useState<{ query: NaturalQueryFilter; matches: Individual[] } | { error: string } | null>(null);

  const [research, setResearch] = useState<{ suggestions: ResearchSuggestion[]; message?: string; error?: string } | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);

  const [wiki, setWiki] = useState<WikipediaCheckResult | null>(null);
  const [wikiLoading, setWikiLoading] = useState(false);

  const [places, setPlaces] = useState<{ clusters: PlaceCluster[]; error?: string } | null>(null);
  const [placesLoading, setPlacesLoading] = useState(false);

  const [narrative, setNarrative] = useState('');
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  const TABS: Array<{ id: LabTab; label: string }> = [
    { id: 'ask', label: 'Recherche NL' },
    { id: 'research', label: 'Suggestions' },
    { id: 'wikipedia', label: 'Wikipédia' },
    { id: 'archives', label: 'Archives' },
    { id: 'places', label: 'Lieux' },
    { id: 'narrative', label: 'Récit' },
  ];

  const runAsk = async () => {
    if (!askText.trim()) return;
    setAskLoading(true);
    setAskResult(null);
    try {
      const query = await naturalQuery(askText, individuals);
      if (!query) return;
      if (query.error) {
        setAskResult({ error: query.error });
      } else {
        const matches = applyQuery(query, individuals);
        setAskResult({ query, matches });
      }
    } finally {
      setAskLoading(false);
    }
  };

  const runResearch = async () => {
    setResearchLoading(true);
    try { setResearch(await researchSuggestions(individuals)); }
    finally { setResearchLoading(false); }
  };

  const runWiki = async () => {
    if (!person) return;
    setWikiLoading(true);
    setWiki(null);
    try { setWiki(await wikipediaCheck(person)); }
    finally { setWikiLoading(false); }
  };

  const runPlaces = async () => {
    setPlacesLoading(true);
    try { setPlaces(await normalizePlaces(individuals, families)); }
    finally { setPlacesLoading(false); }
  };

  const runNarrative = async () => {
    if (!person) return;
    setNarrativeLoading(true);
    try { setNarrative(await familyNarrative(person, individuals, families, 4)); }
    finally { setNarrativeLoading(false); }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-[var(--border)] shrink-0">
        <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1 flex items-center gap-1.5">
          <Icon.Sparkles className="size-3" /> Laboratoire IA
        </div>
        <h2 className="text-[17px] sm:text-xl font-semibold text-[var(--ink)] tracking-tight">Assistance intelligente</h2>
      </div>

      {/* Tab bar */}
      <div className="border-b border-[var(--border)] px-4 sm:px-6 flex gap-0.5 overflow-x-auto no-scrollbar shrink-0">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`relative px-3 py-3 sm:py-2.5 text-[12.5px] sm:text-xs font-medium whitespace-nowrap ${tab === t.id ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'}`}>
            {t.label}
            {tab === t.id && <span className="absolute bottom-0 left-2 right-2 h-px bg-[var(--accent)]" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">

        {/* ── Natural-language search ── */}
        {tab === 'ask' && (
          <AskTab
            askText={askText} onAskTextChange={setAskText}
            onRun={() => void runAsk()} loading={askLoading}
            result={askResult} onNavigate={onNavigate}
          />
        )}

        {/* ── Research suggestions ── */}
        {tab === 'research' && (
          <AiPanel
            title="Identifie les fiches incomplètes les plus prometteuses à rechercher"
            cta="Analyser les fiches incomplètes"
            onRun={() => void runResearch()}
            loading={researchLoading}
            hasResult={!!research}
          >
            {research?.suggestions?.map((s, i) => (
              <button key={i} onClick={() => onNavigate(s.id)}
                className="w-full text-left rounded-md border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] p-3 mb-2">
                <div className="flex items-start gap-3">
                  <div className="size-7 rounded-full grid place-items-center text-xs font-bold font-mono shrink-0"
                    style={{ background: 'color-mix(in oklch, var(--accent) 18%, var(--bg))', color: 'var(--accent)' }}>
                    {s.priority}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--ink)]">{s.name}</div>
                    <div className="text-xs text-[var(--ink-muted)] mt-1">{s.reason}</div>
                    {s.sources && s.sources.length > 0 && (
                      <div className="text-[11px] font-mono text-[var(--ink-faint)] mt-1.5">
                        Sources : {s.sources.join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
            {research?.message && <div className="text-sm text-[var(--ink-faint)] italic">{research.message}</div>}
            {research?.error && <div className="text-sm text-[var(--danger)]">{research.error}</div>}
          </AiPanel>
        )}

        {/* ── Wikipedia ── */}
        {tab === 'wikipedia' && (
          <WikiTab person={person} wiki={wiki} loading={wikiLoading} onRun={() => void runWiki()} />
        )}

        {/* ── Archives ── */}
        {tab === 'archives' && <ArchivesPanel person={person} />}

        {/* ── Place normalization ── */}
        {tab === 'places' && (
          <AiPanel
            title="Regroupe les lieux désignant le même endroit avec des graphies différentes"
            cta="Analyser les lieux"
            onRun={() => void runPlaces()}
            loading={placesLoading}
            hasResult={!!places}
          >
            {places?.clusters?.length === 0 && (
              <div className="text-sm text-[var(--ink-faint)] italic">Aucun cluster détecté — vos lieux sont déjà normalisés.</div>
            )}
            {places?.clusters?.map((cl, i) => (
              <div key={i} className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 mb-2">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <Icon.MapPin className="size-3.5 text-[var(--accent)] shrink-0" />
                  <div className="font-medium text-sm text-[var(--ink)] truncate">{cl.canonical}</div>
                  <span className="text-[10px] font-mono text-[var(--ink-faint)]">{cl.variants.length} variantes</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-5">
                  {cl.variants.map((v, j) => (
                    <span key={j} className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--ink-muted)]">{v}</span>
                  ))}
                </div>
              </div>
            ))}
            {places?.error && <div className="text-sm text-[var(--danger)]">{places.error}</div>}
          </AiPanel>
        )}

        {/* ── Narrative ── */}
        {tab === 'narrative' && (
          <AiPanel
            title={person ? `Rédige un récit retraçant la lignée ascendante de ${person.name.display} sur 4 générations` : 'Sélectionnez d\'abord une personne dans la liste'}
            cta="Générer le récit"
            onRun={() => void runNarrative()}
            loading={narrativeLoading}
            hasResult={!!narrative}
            disabled={!person}
          >
            {narrative && (
              <div className="text-sm text-[var(--ink)] leading-relaxed whitespace-pre-wrap rounded-md border border-[var(--border)] bg-[var(--surface)] p-4">
                {narrative}
              </div>
            )}
          </AiPanel>
        )}

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface AskTabProps {
  askText: string;
  onAskTextChange: (v: string) => void;
  onRun: () => void;
  loading: boolean;
  result: { query: NaturalQueryFilter; matches: Individual[] } | { error: string } | null;
  onNavigate: (id: string) => void;
}

function AskTab({ askText, onAskTextChange, onRun, loading, result, onNavigate }: AskTabProps) {
  const EXAMPLES = ['hommes tisserands avant 1800', 'décès à Paris après 1850', 'femmes nées en Bretagne'];

  return (
    <div>
      <div className="text-sm text-[var(--ink-muted)] mb-3">
        Posez une question en français — l'IA la traduit en filtre et affiche les fiches correspondantes.
      </div>
      <div className="flex flex-col gap-2">
        <textarea
          value={askText}
          onChange={(e) => onAskTextChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onRun(); }}
          rows={2}
          placeholder="ex : mes ancêtres femmes nées en Bretagne au XVIIIe siècle"
          className="w-full rounded-md bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)] resize-none"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onRun}
            disabled={loading || !askText.trim()}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink, white)' }}
          >
            <Icon.Sparkles className="size-4" />
            {loading ? 'Analyse…' : 'Rechercher'}
          </button>
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => onAskTextChange(ex)}
              className="text-[11px] font-mono px-2 py-1 rounded-full border border-[var(--border)] text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]">
              {ex}
            </button>
          ))}
        </div>
      </div>

      {'error' in (result ?? {}) && <div className="mt-3 text-sm text-[var(--danger)]">{(result as { error: string }).error}</div>}

      {result && 'query' in result && (
        <div className="mt-4">
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 mb-3 text-[12px]">
            <span className="font-mono text-[var(--ink-faint)] uppercase tracking-wider text-[10px]">Interprétation</span>
            <div className="text-[var(--ink-muted)] mt-1">{result.query.explanation || 'Filtre appliqué.'}</div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {result.query.sex && <QueryChip label={result.query.sex === 'F' ? 'Femmes' : 'Hommes'} />}
              {result.query.placePattern && <QueryChip label={`Lieu : ${result.query.placePattern}`} />}
              {result.query.surnamePattern && <QueryChip label={`Nom : ${result.query.surnamePattern}`} />}
              {(result.query.yearMin || result.query.yearMax) && <QueryChip label={`${result.query.yearMin ?? '…'}–${result.query.yearMax ?? '…'}`} />}
              {result.query.occupationPattern && <QueryChip label={`Métier : ${result.query.occupationPattern}`} />}
            </div>
          </div>
          <div className="text-[11px] font-mono text-[var(--ink-faint)] mb-2">{result.matches.length} résultat{result.matches.length !== 1 ? 's' : ''}</div>
          <div className="space-y-1.5">
            {result.matches.slice(0, 50).map((p) => (
              <button key={p.id} onClick={() => onNavigate(p.id)}
                className="w-full text-left rounded-md border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] px-3 py-2 flex items-baseline justify-between gap-3">
                <span className="text-sm text-[var(--ink)] truncate">{p.name.display}</span>
                <span className="text-[11px] font-mono text-[var(--ink-faint)] shrink-0">{formatVital(p)}</span>
              </button>
            ))}
            {result.matches.length === 0 && <div className="text-sm text-[var(--ink-faint)] italic">Aucune fiche ne correspond à cette requête.</div>}
          </div>
        </div>
      )}
      <div className="text-[10px] font-mono text-[var(--ink-faint)] mt-4 italic">
        L'interprétation est faite par l'IA puis appliquée localement. Vérifiez les filtres détectés.
      </div>
    </div>
  );
}

function QueryChip({ label }: { label: string }) {
  return (
    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full"
      style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)' }}>
      {label}
    </span>
  );
}

interface AiPanelProps {
  title: string;
  cta: string;
  onRun: () => void;
  loading: boolean;
  hasResult: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

function AiPanel({ title, cta, onRun, loading, hasResult, disabled, children }: AiPanelProps) {
  return (
    <div>
      <div className="text-sm text-[var(--ink-muted)] mb-3">{title}</div>
      {!hasResult && (
        <button onClick={onRun} disabled={loading || disabled}
          className="rounded-md border border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:bg-[color:var(--accent)]/5 px-4 py-6 w-full text-sm text-[var(--ink-muted)] hover:text-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
          <Icon.Sparkles className="size-4" />
          {loading ? 'Analyse en cours…' : cta}
        </button>
      )}
      {hasResult && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">Résultat</div>
            <button onClick={onRun} disabled={loading} className="text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] underline-offset-2 hover:underline">
              {loading ? '…' : 'Régénérer'}
            </button>
          </div>
          {children}
        </div>
      )}
      <div className="text-[10px] font-mono text-[var(--ink-faint)] mt-3 italic">
        Résultats IA mis en cache localement. À vérifier avant publication.
      </div>
    </div>
  );
}

function WikiTab({ person, wiki, loading, onRun }: {
  person: Individual | null;
  wiki: WikipediaCheckResult | null;
  loading: boolean;
  onRun: () => void;
}) {
  return (
    <div>
      <div className="text-sm text-[var(--ink-muted)] mb-3">
        {person
          ? `Recherche « ${person.name.display} » sur Wikipédia FR et analyse la plausibilité historique des faits.`
          : 'Sélectionnez une personne dans la liste.'}
      </div>
      {person && !wiki && (
        <button onClick={onRun} disabled={loading}
          className="rounded-md border border-dashed border-[var(--border)] hover:border-[var(--accent)] px-4 py-6 w-full text-sm text-[var(--ink-muted)] hover:text-[var(--accent)] disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
          <Icon.Sparkles className="size-4" />
          {loading ? 'Vérification…' : 'Vérifier sur Wikipédia'}
        </button>
      )}
      {wiki && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">Résultat</div>
            <button onClick={onRun} disabled={loading} className="text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] hover:underline">{loading ? '…' : 'Régénérer'}</button>
          </div>
          {wiki.wiki && wiki.wiki.length > 0 ? (
            <div className="space-y-2 mb-4">
              {wiki.wiki.slice(0, 5).map((w, i) => {
                const m = wiki.analysis?.matches?.find((mm) => mm.title === w.title);
                return (
                  <a key={i} href={w.url} target="_blank" rel="noopener noreferrer"
                    className="block rounded-md border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[var(--ink)]">{w.title}</span>
                      {m && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                          style={{ background: m.likelyMatch ? 'color-mix(in oklch, var(--success) 18%, transparent)' : 'var(--surface-hover)', color: m.likelyMatch ? 'var(--success)' : 'var(--ink-faint)' }}>
                          {m.likelyMatch ? 'correspondance probable' : 'peu probable'}
                        </span>
                      )}
                    </div>
                    {w.desc && <div className="text-xs text-[var(--ink-muted)] mt-1">{w.desc}</div>}
                    {m?.reason && <div className="text-[11px] text-[var(--ink-faint)] mt-1 italic">{m.reason}</div>}
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-[var(--ink-faint)] italic mb-4">Aucun résultat Wikipédia pour ce nom (normal pour un ancêtre non public).</div>
          )}
          {wiki.analysis?.plausibilityNotes && (
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 mb-3">
              <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1">Cohérence historique</div>
              <div className="text-sm text-[var(--ink)]">{wiki.analysis.plausibilityNotes}</div>
            </div>
          )}
          {wiki.analysis?.redFlags && wiki.analysis.redFlags.length > 0 && (
            <div className="rounded-md border p-3" style={{ borderColor: 'var(--warn)', background: 'color-mix(in oklch, var(--warn) 8%, transparent)' }}>
              <div className="text-[10.5px] font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--warn)' }}>Alertes</div>
              <ul className="text-sm text-[var(--ink)] list-disc pl-4 space-y-0.5">
                {wiki.analysis.redFlags.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
          {wiki.error && <div className="text-sm text-[var(--danger)]">{wiki.error}</div>}
        </div>
      )}
      <div className="text-[10px] font-mono text-[var(--ink-faint)] mt-4 italic">
        Données Wikipédia via l'API publique. L'analyse de plausibilité est indicative.
      </div>
    </div>
  );
}

function ArchivesPanel({ person }: { person: Individual | null }) {
  if (!person) {
    return <div className="text-sm text-[var(--ink-faint)] italic px-2 py-6 text-center">Sélectionnez une personne pour afficher les pistes d'archives.</div>;
  }

  const places = [person.birth?.place, person.death?.place].filter((p): p is string => !!p);
  const blocks = places.length === 0
    ? [{ place: null as string | null, links: linksFor({ person, place: null }) }]
    : places.map((place) => ({ place, links: linksFor({ person, place }) }));

  return (
    <div>
      <div className="text-sm text-[var(--ink-muted)] mb-3">
        Liens vers les portails généalogiques + archives départementales déduits des lieux de naissance et décès.
      </div>
      {blocks.map((b, i) => {
        const dept = b.place ? extractDept(b.place) : null;
        const deptFullName = dept ? getDeptName(dept) : null;
        return (
          <div key={i} className="mb-4 rounded-md border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center gap-2 flex-wrap">
              <Icon.MapPin className="size-3.5 text-[var(--accent)]" />
              <span className="text-sm font-semibold text-[var(--ink)]">{b.place || 'Recherche générale'}</span>
              {deptFullName && dept && (
                <span className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">
                  · {deptFullName} ({dept})
                </span>
              )}
            </div>
            <div className="divide-y divide-[var(--border)]">
              {b.links.map((l, j) => (
                <a key={j} href={l.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[var(--surface-hover)]">
                  <div className="min-w-0">
                    <div className="text-sm text-[var(--ink)] truncate">{l.label}</div>
                    <div className="text-[10.5px] font-mono text-[var(--ink-faint)] mt-0.5">
                      {l.kind === 'archives' ? 'Archives départementales' : l.source}
                    </div>
                  </div>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ink-faint)] shrink-0">
                    <path d="M14 3h7v7" /><path d="M21 3l-9 9" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        );
      })}
      {/* Also show dedicated archive dept page if we can resolve a dept */}
      {person.birth?.place && (() => {
        const dept = extractDept(person.birth!.place);
        if (!dept) return null;
        const ad = deptArchives(dept);
        if (!ad) return null;
        return (
          <div className="text-[10.5px] font-mono text-[var(--ink-faint)] italic">
            Site des archives : <a href={ad.url} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">{ad.label}</a>
          </div>
        );
      })()}
    </div>
  );
}
