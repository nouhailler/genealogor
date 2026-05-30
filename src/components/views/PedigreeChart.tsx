import { useMemo } from 'react';
import type { Individual, Family } from '@/types/genealogy';
import { isImplexedFor, type ImplexResult } from '@/lib/implex';

interface Props {
  rootPerson: Individual;
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  generations?: number;
  onSelect: (id: string) => void;
  implexData?: ImplexResult | null;
}

export default function PedigreeChart({ rootPerson, individuals, families, generations = 5, onSelect, implexData }: Props) {
  const ancestors = useMemo(() => {
    const map = new Map<number, Individual | null>();
    function visit(p: Individual | undefined | null, sosa: number, gen: number) {
      if (gen > generations) return;
      map.set(sosa, p ?? null);
      if (!p || gen === generations) return;
      const fam = p.famc?.[0] ? families.get(p.famc[0]) : null;
      if (!fam) return;
      if (fam.husband) visit(individuals.get(fam.husband), sosa * 2, gen + 1);
      if (fam.wife)    visit(individuals.get(fam.wife),    sosa * 2 + 1, gen + 1);
    }
    visit(rootPerson, 1, 0);
    return map;
  }, [rootPerson.id, individuals, families, generations]);

  const colWidth = 168;
  const rowHeight = 56;
  const lastGenCount = Math.pow(2, generations);
  const totalHeight = lastGenCount * rowHeight + 40;
  const totalWidth = (generations + 1) * colWidth + 60;

  function nodeY(sosa: number, gen: number): number {
    const idx = sosa - Math.pow(2, gen);
    const rowsAtGen = Math.pow(2, gen);
    const sliceHeight = (lastGenCount * rowHeight) / rowsAtGen;
    return 30 + idx * sliceHeight + sliceHeight / 2;
  }
  function nodeX(gen: number): number {
    return 30 + gen * colWidth;
  }

  const connectors: { key: string; d: string }[] = [];
  for (let gen = 0; gen < generations; gen++) {
    const rows = Math.pow(2, gen);
    for (let i = 0; i < rows; i++) {
      const childSosa = Math.pow(2, gen) + i;
      const fatherSosa = childSosa * 2;
      const motherSosa = childSosa * 2 + 1;
      const cx = nodeX(gen) + colWidth - 18;
      const cy = nodeY(childSosa, gen);
      const fx = nodeX(gen + 1);
      const fy = nodeY(fatherSosa, gen + 1);
      const my = nodeY(motherSosa, gen + 1);
      const midX = (cx + fx) / 2;
      connectors.push({
        key: `c-${childSosa}`,
        d: `M ${cx} ${cy} L ${midX} ${cy} L ${midX} ${fy} L ${fx} ${fy} M ${midX} ${cy} L ${midX} ${my} L ${fx} ${my}`,
      });
    }
  }

  return (
    <div className="w-full overflow-auto -mx-1" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      <svg viewBox={`0 0 ${totalWidth} ${totalHeight}`} className="block" style={{ minWidth: Math.min(totalWidth, 1100), height: totalHeight }}>
        {Array.from({ length: generations + 1 }).map((_, g) => (
          <text key={`hdr-${g}`} x={nodeX(g) + (colWidth - 36) / 2} y={18}
            textAnchor="middle" fontSize="10" fill="var(--ink-faint)"
            style={{ fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: 1 }}>
            G{g}
          </text>
        ))}
        {connectors.map((c) => (
          <path key={c.key} d={c.d} fill="none" stroke="var(--border-strong)" strokeWidth="1" />
        ))}
        {Array.from(ancestors.entries()).map(([sosa, person]) => {
          const gen = Math.floor(Math.log2(sosa));
          const x = nodeX(gen);
          const y = nodeY(sosa, gen);
          const sex = sosa === 1 ? 'self' : sosa % 2 === 0 ? 'M' : 'F';
          const isImplex = person && implexData ? isImplexedFor(person.id, implexData) : false;
          const fill = !person
            ? 'var(--surface)'
            : sosa === 1
            ? 'var(--accent-soft)'
            : sex === 'M'
            ? 'color-mix(in oklch, var(--sex-m) 12%, var(--bg))'
            : 'color-mix(in oklch, var(--sex-f) 12%, var(--bg))';

          return (
            <g key={`n-${sosa}`}
              transform={`translate(${x}, ${y - 20})`}
              style={{ cursor: person ? 'pointer' : 'default' }}
              onClick={() => person && onSelect(person.id)}
            >
              <rect x={0} y={0} width={colWidth - 36} height={40} rx={4}
                fill={fill}
                stroke={sosa === 1 ? 'var(--accent)' : 'var(--border)'}
                strokeWidth={sosa === 1 ? 1.5 : 1}
              />
              <rect x={4} y={4} width={26} height={12} rx={2} fill="var(--bg)" stroke="var(--border)" strokeWidth="0.5" />
              <text x={17} y={13} textAnchor="middle" fontSize="9" fill="var(--ink-faint)" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {sosa}
              </text>
              {person ? (
                <>
                  <text x={34} y={14} fontSize="11" fontWeight="600" fill="var(--ink)" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {(person.name.given || '').slice(0, 16)}
                  </text>
                  <text x={34} y={26} fontSize="10" fontWeight="600" fill="var(--ink)" style={{ fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' }}>
                    {(person.name.surname || '').slice(0, 18)}
                  </text>
                  <text x={4} y={36} fontSize="9" fill="var(--ink-faint)" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {person.birth?.date?.year || '?'}
                    {person.death?.date?.year ? ` – ${person.death.date.year}` : ''}
                  </text>
                  {isImplex && (
                    <circle cx={colWidth - 44} cy={8} r={3.5} fill="var(--warn)" stroke="var(--bg)" strokeWidth="1">
                      <title>Ancêtre en implication</title>
                    </circle>
                  )}
                </>
              ) : (
                <text x={(colWidth - 36) / 2} y={24} textAnchor="middle" fontSize="10" fill="var(--ink-faint)"
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontStyle: 'italic' }}>
                  inconnu
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
