import { useMemo } from 'react';
import type { Individual, Family } from '@/types/genealogy';
import { computeAboville } from '@/lib/descendance';
import { formatVital, sexColor } from '@/components/ui-kit';

interface Props {
  person: Individual;
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  onSelect: (id: string) => void;
  genUp?: number;
  genDown?: number;
}

export default function HourglassView({ person, individuals, families, onSelect, genUp = 4, genDown = 4 }: Props) {
  const abovilleMap = useMemo(
    () => computeAboville(person, individuals, families, genDown + 1),
    [person.id, individuals, families, genDown],
  );

  const ancestors = useMemo(() => {
    const map = new Map<number, Individual | null>();
    function visit(p: Individual | undefined | null, sosa: number, gen: number) {
      if (gen > genUp) return;
      map.set(sosa, p ?? null);
      if (!p || gen === genUp) return;
      const fam = p.famc?.[0] ? families.get(p.famc[0]) : null;
      if (!fam) return;
      if (fam.husband) visit(individuals.get(fam.husband), sosa * 2, gen + 1);
      if (fam.wife) visit(individuals.get(fam.wife), sosa * 2 + 1, gen + 1);
    }
    visit(person, 1, 0);
    return map;
  }, [person.id, individuals, families, genUp]);

  const descendants = useMemo(() => {
    const byGen = new Map<number, Individual[]>();
    function visit(p: Individual, gen: number) {
      if (!p || gen > genDown) return;
      if (gen > 0) {
        if (!byGen.has(gen)) byGen.set(gen, []);
        byGen.get(gen)!.push(p);
      }
      if (gen === genDown) return;
      for (const fid of p.fams || []) {
        const fam = families.get(fid);
        if (!fam) continue;
        for (const cid of fam.children || []) {
          const child = individuals.get(cid);
          if (child) visit(child, gen + 1);
        }
      }
    }
    visit(person, 0);
    return byGen;
  }, [person.id, individuals, families, genDown]);

  const ancestorCount = Array.from(ancestors.values()).filter(Boolean).length - 1;
  const descendantCount = Array.from(descendants.values()).reduce((s, a) => s + a.length, 0);

  return (
    <div className="w-full space-y-3">
      {/* Ancestors — gen max → gen 1 */}
      {Array.from({ length: genUp }, (_, i) => genUp - i).map((gen) => {
        const count = Math.pow(2, gen);
        const items = Array.from({ length: count }, (_, i) => {
          const sosa = Math.pow(2, gen) + i;
          return { sosa, person: ancestors.get(sosa) ?? null };
        });
        return (
          <HourglassRow key={`up-${gen}`} gen={gen} direction="up" items={items} onSelect={onSelect} abovilleMap={abovilleMap} />
        );
      })}

      {/* Self */}
      <HourglassSelf person={person} ancestorCount={ancestorCount} descendantCount={descendantCount} />

      {/* Descendants — gen 1 → gen max */}
      {Array.from({ length: genDown }, (_, i) => i + 1).map((gen) => {
        const items = (descendants.get(gen) || []).map((p) => ({ person: p, aboville: abovilleMap.get(p.id) }));
        if (items.length === 0) return null;
        return (
          <HourglassRow key={`down-${gen}`} gen={gen} direction="down" items={items} onSelect={onSelect} abovilleMap={abovilleMap} />
        );
      })}
    </div>
  );
}

interface RowItem { sosa?: number; person: Individual | null; aboville?: string }

function HourglassRow({ gen, direction, items, onSelect, abovilleMap }: {
  gen: number; direction: 'up' | 'down'; items: RowItem[];
  onSelect: (id: string) => void; abovilleMap: Map<string, string>;
}) {
  const isUp = direction === 'up';
  const label = isUp ? `Génération +${gen}` : `Génération −${gen}`;
  const colorBand = isUp
    ? 'color-mix(in oklch, var(--sex-m) 6%, transparent)'
    : 'color-mix(in oklch, var(--accent) 6%, transparent)';

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">{label}</span>
        <span className="text-[10.5px] font-mono text-[var(--ink-faint)]">·</span>
        <span className="text-[10.5px] font-mono text-[var(--ink-faint)]">
          {items.filter((it) => it.person).length}/{items.length}
        </span>
      </div>
      <div className="rounded-md p-2 flex flex-wrap gap-1.5" style={{ background: colorBand, border: '1px solid var(--border)' }}>
        {items.map((it, i) => (
          <HourglassChip
            key={`${direction}-${gen}-${i}`}
            person={it.person}
            sosa={it.sosa}
            aboville={it.person ? abovilleMap.get(it.person.id) : undefined}
            direction={direction}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function HourglassChip({ person, sosa, aboville, direction, onSelect }: {
  person: Individual | null; sosa?: number; aboville?: string;
  direction: 'up' | 'down'; onSelect: (id: string) => void;
}) {
  if (!person) {
    return (
      <div className="rounded border border-dashed border-[var(--border-strong)] px-2 py-1 text-[10px] font-mono text-[var(--ink-faint)] flex items-center justify-center" style={{ minWidth: 84, minHeight: 36 }}>
        {sosa ? `Sosa ${sosa}` : '—'}
      </div>
    );
  }
  const year = person.birth?.date?.year || person.death?.date?.year || '';
  const badge = direction === 'up' ? (sosa ? `Sosa ${sosa}` : null) : (aboville || null);
  return (
    <button
      onClick={() => onSelect(person.id)}
      className="rounded border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] active:bg-[var(--surface-hover)] px-2 py-1 text-left transition-colors"
      style={{ minWidth: 84, maxWidth: 180 }}
    >
      {badge && (
        <div className="text-[8.5px] font-mono text-[var(--ink-faint)] uppercase tracking-wider mb-0.5 truncate">{badge}</div>
      )}
      <div className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full shrink-0" style={{ background: sexColor(person.sex) }} />
        <span className="text-[11px] font-medium text-[var(--ink)] truncate">{(person.name.given || '').split(/\s+/)[0]}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2 mt-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-tight text-[var(--ink-muted)] truncate">{person.name.surname || '?'}</span>
        {year && <span className="text-[9px] font-mono text-[var(--ink-faint)] tabular-nums shrink-0">{year}</span>}
      </div>
    </button>
  );
}

function HourglassSelf({ person, ancestorCount, descendantCount }: { person: Individual; ancestorCount: number; descendantCount: number }) {
  return (
    <div className="my-4 flex flex-col items-center">
      <div className="w-full flex items-center gap-2 mb-2">
        <div className="flex-1 h-px bg-[var(--accent)] opacity-30" />
        <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--accent)]">Personne focale</div>
        <div className="flex-1 h-px bg-[var(--accent)] opacity-30" />
      </div>
      <div className="rounded-md border-2 px-4 py-3 max-w-md w-full text-center" style={{ borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}>
        <div className="text-base font-semibold text-[var(--ink)] tracking-tight">{person.name.display}</div>
        <div className="text-[11px] font-mono text-[var(--ink-muted)] mt-1">{formatVital(person)}</div>
        <div className="flex items-center justify-center gap-4 mt-2 pt-2 border-t border-[var(--border)]">
          <div>
            <div className="text-[9px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">Ancêtres</div>
            <div className="text-sm font-semibold tabular-nums">{ancestorCount}</div>
          </div>
          <div className="h-6 w-px bg-[var(--border)]" />
          <div>
            <div className="text-[9px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">Descendants</div>
            <div className="text-sm font-semibold tabular-nums">{descendantCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
