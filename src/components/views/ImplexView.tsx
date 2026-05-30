import { useMemo } from 'react';
import type { Individual, Family } from '@/types/genealogy';
import { compute as computeImplex, type ImplexResult } from '@/lib/implex';
import { formatVital, Icon } from '@/components/ui-kit';

// ── Sub-components ────────────────────────────────────────────────────────────

interface KpiProps { label: string; value: string | number; sub?: string; accent?: string }
function Kpi({ label, value, sub, accent }: KpiProps) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1" style={{ color: accent || 'var(--ink)' }}>{value}</div>
      {sub && <div className="text-[10.5px] font-mono text-[var(--ink-faint)] mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Main ImplexView ───────────────────────────────────────────────────────────

interface Props {
  person: Individual;
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  onNavigate: (id: string) => void;
}

export default function ImplexView({ person, individuals, families, onNavigate }: Props) {
  const data: ImplexResult = useMemo(() => {
    return computeImplex(person, individuals, families, 10);
  }, [person, individuals, families]);

  const maxImplex = data.implexEntries[0]?.sosaNumbers.length || 1;

  return (
    <div className="h-full overflow-y-auto mobile-pb-safe">
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-4 border-b border-[var(--border)] sticky top-0 z-10 bg-[var(--bg)]">
        <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1">
          Implications & endogamie
        </div>
        <h2 className="text-[17px] sm:text-xl font-semibold text-[var(--ink)] tracking-tight truncate">
          Ancêtres de {person.name.display}
        </h2>
      </div>

      <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
          <Kpi label="Taux d'endogamie" value={`${data.globalEndogamy.toFixed(1)}%`}
            sub="part des cases Sosa redondantes" accent={data.globalEndogamy > 5 ? 'var(--warn)' : 'var(--accent)'} />
          <Kpi label="Ancêtres distincts" value={data.distinctAncestors}
            sub={`sur ${data.totalAncestorSlots} cases Sosa`} />
          <Kpi label="Cas d'implication" value={data.implexEntries.length}
            sub="ancêtres apparaissant ≥ 2 fois" />
          <Kpi label="Multi-occurrence max" value={maxImplex + '×'}
            sub="apparitions d'un même ancêtre" />
        </div>

        {/* Per-generation breakdown */}
        <section>
          <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-2">
            Complétude et endogamie par génération
          </div>
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] overflow-x-auto">
            <div className="grid grid-cols-[48px_1fr_64px_64px_64px] sm:grid-cols-[60px_1fr_80px_80px_80px] gap-2 sm:gap-3 px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-[var(--ink-faint)] min-w-[420px]">
              <div>Gén.</div>
              <div>Complétude</div>
              <div className="text-right">Présents</div>
              <div className="text-right">Distincts</div>
              <div className="text-right">Endog.</div>
            </div>
            {data.generationStats.slice(0, 9).map((g) => g.theoretical <= 256 && (
              <div key={g.generation} className="grid grid-cols-[48px_1fr_64px_64px_64px] sm:grid-cols-[60px_1fr_80px_80px_80px] gap-2 sm:gap-3 px-3 py-2 items-center min-w-[420px]">
                <div className="font-mono text-sm text-[var(--ink)] tabular-nums">G{g.generation}</div>
                <div className="h-2 bg-[var(--bg)] rounded-full overflow-hidden flex">
                  <div style={{
                    width: `${(g.distinct / g.theoretical) * 100}%`,
                    background: 'var(--accent)',
                  }} title={`${g.distinct} distincts`} />
                  <div style={{
                    width: `${((g.present - g.distinct) / g.theoretical) * 100}%`,
                    background: 'var(--warn)',
                  }} title={`${g.present - g.distinct} cas implexes`} />
                </div>
                <div className="font-mono text-xs text-[var(--ink-muted)] tabular-nums text-right">
                  {g.present}/{g.theoretical}
                </div>
                <div className="font-mono text-xs text-[var(--ink)] tabular-nums text-right">{g.distinct}</div>
                <div className="font-mono text-xs tabular-nums text-right" style={{ color: g.endogamyRate > 0 ? 'var(--warn)' : 'var(--ink-faint)' }}>
                  {g.endogamyRate > 0 ? g.endogamyRate.toFixed(1) + '%' : '—'}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Implex list */}
        <section>
          <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-2">
            Ancêtres en implication ({data.implexEntries.length})
          </div>
          {data.implexEntries.length === 0 ? (
            <div className="text-sm text-[var(--ink-faint)] italic">
              Aucune implication détectée. Tous les ancêtres connus sont distincts.
            </div>
          ) : (
            <div className="rounded-md border border-[var(--border)] divide-y divide-[var(--border)]">
              {data.implexEntries.slice(0, 50).map((entry, i) => (
                <button key={i} onClick={() => onNavigate(entry.person.id)}
                  className="w-full text-left px-3 py-2.5 hover:bg-[var(--surface-hover)] flex items-center gap-3">
                  <span className="size-6 rounded-full grid place-items-center text-[10px] font-bold font-mono"
                    style={{ background: 'color-mix(in oklch, var(--warn) 20%, var(--bg))', color: 'var(--warn)' }}>
                    {entry.sosaNumbers.length}×
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-[var(--ink)] truncate">
                      <span className="font-medium">{entry.person.name.display}</span>
                      <span className="text-[var(--ink-faint)] font-mono"> · {formatVital(entry.person)}</span>
                    </div>
                    <div className="text-[11px] font-mono text-[var(--ink-faint)] mt-0.5">
                      Sosa : {entry.sosaNumbers.slice(0, 6).join(', ')}{entry.sosaNumbers.length > 6 ? '…' : ''}
                      <span className="ml-3">Gén. {[...new Set(entry.generations)].join(', ')}</span>
                    </div>
                  </div>
                  <Icon.ChevronRight className="size-3.5 text-[var(--ink-faint)] shrink-0" />
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="text-[11px] text-[var(--ink-faint)] italic">
          L'endogamie mesure la part de cases Sosa occupées par un ancêtre déjà présent ailleurs dans l'arbre. Un taux élevé indique des mariages consanguins ou entre cousins.
        </div>
      </div>
    </div>
  );
}
