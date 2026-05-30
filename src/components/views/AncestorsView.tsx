import { useState, useMemo } from 'react';
import type { Individual, Family } from '@/types/genealogy';
import { compute as computeImplex, isImplexedFor, type ImplexResult } from '@/lib/implex';
import PedigreeChart from './PedigreeChart';
import HourglassView from './HourglassView';

// ── Sosa ancestor walk ────────────────────────────────────────────────────────

interface AncestorNode { person: Individual; sosa: number; generation: number }

export function computeAncestors(
  person: Individual,
  individuals: Map<string, Individual>,
  families: Map<string, Family>,
  maxGen = 5,
): Map<number, AncestorNode> {
  const map = new Map<number, AncestorNode>();
  function visit(p: Individual | undefined, sosa: number, gen: number) {
    if (!p || gen > maxGen) return;
    map.set(sosa, { person: p, sosa, generation: gen });
    if (gen === maxGen) return;
    if (!p.famc?.length) return;
    const fam = families.get(p.famc[0]);
    if (!fam) return;
    if (fam.husband) visit(individuals.get(fam.husband), sosa * 2, gen + 1);
    if (fam.wife) visit(individuals.get(fam.wife), sosa * 2 + 1, gen + 1);
  }
  visit(person, 1, 0);
  return map;
}

// ── FanChart ──────────────────────────────────────────────────────────────────

function arcPath(cx: number, cy: number, innerR: number, outerR: number, startDeg: number, endDeg: number): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + outerR * Math.cos(toRad(startDeg));
  const y1 = cy + outerR * Math.sin(toRad(startDeg));
  const x2 = cx + outerR * Math.cos(toRad(endDeg));
  const y2 = cy + outerR * Math.sin(toRad(endDeg));
  const x3 = cx + innerR * Math.cos(toRad(endDeg));
  const y3 = cy + innerR * Math.sin(toRad(endDeg));
  const x4 = cx + innerR * Math.cos(toRad(startDeg));
  const y4 = cy + innerR * Math.sin(toRad(startDeg));
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  if (innerR === 0) {
    return `M ${cx} ${cy} L ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  }
  return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  // avoid unused vars (y3, y4 used implicitly in path string)
  void y3; void y4;
}

interface FanChartProps {
  rootPerson: Individual;
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  generations: number;
  onSelect: (id: string) => void;
  implexData: ImplexResult | null;
}

function FanChart({ rootPerson, individuals, families, generations, onSelect, implexData }: FanChartProps) {
  const ancestors = useMemo(
    () => computeAncestors(rootPerson, individuals, families, generations),
    [rootPerson.id, individuals, families, generations],
  );

  const size = 720;
  const cx = size / 2;
  const cy = size - 40;
  const baseRadius = 60;
  const ringWidth = (size / 2 - baseRadius - 20) / generations;

  const arcs = [];
  for (let gen = 0; gen <= generations; gen++) {
    const count = Math.pow(2, gen);
    const sweep = 180 / count;
    for (let i = 0; i < count; i++) {
      const sosa = Math.pow(2, gen) + i;
      const node = ancestors.get(sosa);
      const startAngle = 180 + i * sweep;
      const endAngle = 180 + (i + 1) * sweep;
      const innerR = gen === 0 ? 0 : baseRadius + (gen - 1) * ringWidth;
      const outerR = gen === 0 ? baseRadius : baseRadius + gen * ringWidth;
      arcs.push({ sosa, gen, startAngle, endAngle, innerR, outerR, node });
    }
  }

  return (
    <div className="w-full overflow-auto -mx-1">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-3xl mx-auto block" style={{ minWidth: 320 }}>
        {arcs.map((arc, i) => {
          const isFilled = !!arc.node;
          const sex = arc.sosa === 1 ? 'self' : arc.sosa % 2 === 0 ? 'M' : 'F';
          const fill = !isFilled
            ? 'var(--surface)'
            : sex === 'self'
            ? 'var(--accent-soft)'
            : sex === 'M'
            ? 'color-mix(in oklch, var(--sex-m) 18%, var(--bg))'
            : 'color-mix(in oklch, var(--sex-f) 18%, var(--bg))';

          const mid = (arc.startAngle + arc.endAngle) / 2;
          const r = (arc.innerR + arc.outerR) / 2;
          const lx = cx + r * Math.cos((mid * Math.PI) / 180);
          const ly = cy + r * Math.sin((mid * Math.PI) / 180);
          let rotate = mid + 90;
          if (mid > 270) rotate -= 180;
          const fontSize = arc.gen === 0 ? 14 : arc.gen <= 2 ? 11 : arc.gen <= 4 ? 9 : 8;
          const isImplex = arc.node && implexData ? isImplexedFor(arc.node.person.id, implexData) : false;
          const midAngle = mid;
          const markerR = arc.outerR - 6;
          const mx = cx + markerR * Math.cos((midAngle * Math.PI) / 180);
          const my = cy + markerR * Math.sin((midAngle * Math.PI) / 180);

          return (
            <g key={i}>
              <path
                d={arcPath(cx, cy, arc.innerR, arc.outerR, arc.startAngle, arc.endAngle)}
                fill={fill}
                stroke="var(--border)"
                strokeWidth="1"
                style={{ cursor: arc.node ? 'pointer' : 'default' }}
                onClick={() => arc.node && onSelect(arc.node.person.id)}
              />
              {arc.node && (
                <g pointerEvents="none">
                  <g transform={`translate(${lx}, ${ly}) rotate(${rotate})`}>
                    <text textAnchor="middle" dominantBaseline="middle"
                      fontSize={fontSize} fontWeight="600" fill="var(--ink)"
                      style={{ fontFamily: 'Inter, sans-serif' }}>
                      <tspan x="0" dy="-0.4em">{(arc.node.person.name.given || '').slice(0, 14)}</tspan>
                      <tspan x="0" dy="1.1em" style={{ textTransform: 'uppercase', fontSize: fontSize * 0.92 }}>
                        {(arc.node.person.name.surname || '').slice(0, 14)}
                      </tspan>
                      {arc.node.person.birth?.date?.year && arc.gen <= 4 && (
                        <tspan x="0" dy="1.05em" fontSize={fontSize * 0.78} fill="var(--ink-faint)" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {arc.node.person.birth.date.year}
                        </tspan>
                      )}
                    </text>
                  </g>
                  {isImplex && (
                    <circle cx={mx} cy={my} r={3} fill="var(--warn)" stroke="var(--bg)" strokeWidth="1.5">
                      <title>Ancêtre en implication</title>
                    </circle>
                  )}
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── AncestorsView ─────────────────────────────────────────────────────────────

interface Props {
  person: Individual | null;
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  onSelect: (id: string) => void;
}

export default function AncestorsView({ person, individuals, families, onSelect }: Props) {
  const [generations, setGenerations] = useState(4);
  const [mode, setMode] = useState<'fan' | 'pedigree' | 'hourglass'>('fan');

  const ancestors = useMemo(
    () => person ? computeAncestors(person, individuals, families, generations) : new Map(),
    [person?.id, individuals, families, generations],
  );
  const implexData = useMemo(
    () => person ? computeImplex(person, individuals, families, generations) : null,
    [person?.id, individuals, families, generations],
  );

  if (!person) {
    return (
      <div className="h-full grid place-items-center text-sm text-[var(--ink-faint)]">
        Sélectionnez une personne pour afficher son ascendance.
      </div>
    );
  }

  const theoretical = Math.pow(2, generations + 1) - 1;
  const known = ancestors.size;
  const pct = ((known / theoretical) * 100).toFixed(0);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-[var(--border)] flex flex-col gap-3 shrink-0">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="min-w-0">
            <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1">
              {mode === 'fan' ? 'Ascendance · éventail Sosa' : mode === 'pedigree' ? 'Ascendance · pedigree classique' : 'Sablier · ancêtres + descendants'}
            </div>
            <h2 className="text-[17px] sm:text-xl font-semibold text-[var(--ink)] tracking-tight truncate">{person.name.display}</h2>
            <div className="text-[11px] font-mono text-[var(--ink-faint)] mt-1">
              {known}/{theoretical} ancêtres · {pct}% complet
              {implexData && implexData.implexEntries.length > 0 && (
                <span className="ml-2 text-[var(--warn)]">· {implexData.implexEntries.length} implications</span>
              )}
            </div>
          </div>
          {mode !== 'hourglass' && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline text-[11px] font-mono text-[var(--ink-faint)]">Générations</span>
              <div className="flex items-center gap-1 p-1 rounded-md bg-[var(--surface)] border border-[var(--border)]">
                {(mode === 'pedigree' ? [4, 5, 6, 7] : [3, 4, 5, 6]).map((n) => (
                  <button key={n} onClick={() => setGenerations(n)}
                    className={`size-8 sm:size-7 text-xs font-medium rounded ${generations === n ? 'bg-[var(--bg)] text-[var(--ink)] shadow-sm' : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'}`}
                  >{n}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mode chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 sm:-mx-6 px-4 sm:px-6">
          {([['fan', 'Éventail'], ['pedigree', 'Pedigree'], ['hourglass', 'Sablier']] as [string, string][]).map(([k, label]) => {
            const isActive = mode === k;
            return (
              <button key={k} onClick={() => setMode(k as 'fan' | 'pedigree' | 'hourglass')}
                className="px-3.5 py-1.5 text-[12.5px] rounded-full whitespace-nowrap font-medium shrink-0 transition-colors active:opacity-70"
                style={{
                  background: isActive ? 'var(--ink)' : 'var(--surface)',
                  color: isActive ? 'var(--bg)' : 'var(--ink-muted)',
                  border: `1px solid ${isActive ? 'var(--ink)' : 'var(--border)'}`,
                }}
              >{label}</button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 sm:p-4 mobile-pb-safe">
        {mode === 'fan' && (
          <>
            <FanChart
              rootPerson={person}
              individuals={individuals}
              families={families}
              generations={generations}
              onSelect={onSelect}
              implexData={implexData}
            />
            {implexData && implexData.implexEntries.length > 0 && (
              <div className="mt-3 text-[11px] font-mono text-[var(--ink-faint)] text-center flex items-center justify-center gap-2">
                <span className="inline-block size-2 rounded-full" style={{ background: 'var(--warn)' }} />
                Points orange = ancêtres apparaissant à plusieurs positions Sosa
              </div>
            )}
          </>
        )}
        {mode === 'pedigree' && (
          <PedigreeChart
            rootPerson={person}
            individuals={individuals}
            families={families}
            generations={generations}
            onSelect={onSelect}
            implexData={implexData}
          />
        )}
        {mode === 'hourglass' && (
          <HourglassView
            person={person}
            individuals={individuals}
            families={families}
            onSelect={onSelect}
            genUp={4}
            genDown={4}
          />
        )}
      </div>
    </div>
  );
}
