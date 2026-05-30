import { useState, useMemo } from 'react';
import type { Individual, Family } from '@/types/genealogy';
import { computeCohortLifeExpectancy, findDeadBranches } from '@/lib/descendance';
import { formatVital } from '@/components/ui-kit';

// ── AgePyramid ────────────────────────────────────────────────────────────────

interface AgePyramidProps {
  individuals: Map<string, Individual>;
  mode?: 'lifespan' | 'currentAge';
}

export function AgePyramid({ individuals, mode = 'lifespan' }: AgePyramidProps) {
  const [activeMode, setActiveMode] = useState<'lifespan' | 'currentAge'>(mode);

  const data = useMemo(() => {
    const buckets: { from: number; label: string; m: number; f: number; total: number }[] = [];
    const SIZE = 10;
    for (let i = 0; i < 11; i++) {
      const from = i * SIZE;
      const to = i === 10 ? '+' : `–${from + SIZE - 1}`;
      buckets.push({ from, label: `${from}${to}`, m: 0, f: 0, total: 0 });
    }
    const now = new Date().getFullYear();
    let counted = 0;
    for (const p of individuals.values()) {
      let age: number | null = null;
      if (activeMode === 'lifespan') {
        const by = p.birth?.date?.year;
        const dy = p.death?.date?.year;
        if (by && dy && dy >= by) age = dy - by;
      } else {
        const by = p.birth?.date?.year;
        const dy = p.death?.date?.year;
        if (by && !dy && now - by <= 120 && now - by >= 0) age = now - by;
      }
      if (age == null || age < 0 || age > 130) continue;
      const idx = Math.min(10, Math.floor(age / SIZE));
      const bucket = buckets[idx];
      if (p.sex === 'M') bucket.m++;
      else if (p.sex === 'F') bucket.f++;
      bucket.total++;
      counted++;
    }
    const maxSide = Math.max(1, ...buckets.map((b) => Math.max(b.m, b.f)));
    return { buckets, counted, maxSide };
  }, [individuals, activeMode]);

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="text-[11px] font-mono text-[var(--ink-faint)]">
          {data.counted} individus comptabilisés
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-md bg-[var(--bg)] border border-[var(--border)]">
          {(['lifespan', 'currentAge'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setActiveMode(k)}
              className={`px-2.5 py-1 text-[11px] rounded ${activeMode === k ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm' : 'text-[var(--ink-muted)]'}`}
            >
              {k === 'lifespan' ? 'Âges au décès' : 'Vivants'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        {[...data.buckets].reverse().map((b) => {
          const mPct = (b.m / data.maxSide) * 100;
          const fPct = (b.f / data.maxSide) * 100;
          return (
            <div key={b.from} className="grid grid-cols-[1fr_56px_1fr] items-center gap-1.5 sm:gap-2">
              <div className="h-5 sm:h-6 flex justify-end relative">
                <div
                  className="h-full rounded-l transition-all"
                  style={{ width: `${mPct}%`, background: 'var(--sex-m)', opacity: 0.85 }}
                  title={`Hommes ${b.label}: ${b.m}`}
                />
                {b.m > 0 && (
                  <span
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-mono tabular-nums"
                    style={{ color: mPct > 22 ? 'white' : 'var(--ink-muted)' }}
                  >
                    {b.m}
                  </span>
                )}
              </div>
              <div className="text-center text-[10.5px] font-mono tabular-nums text-[var(--ink-muted)] px-1 leading-none">
                {b.label}
              </div>
              <div className="h-5 sm:h-6 flex justify-start relative">
                <div
                  className="h-full rounded-r transition-all"
                  style={{ width: `${fPct}%`, background: 'var(--sex-f)', opacity: 0.85 }}
                  title={`Femmes ${b.label}: ${b.f}`}
                />
                {b.f > 0 && (
                  <span
                    className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-mono tabular-nums"
                    style={{ color: fPct > 22 ? 'white' : 'var(--ink-muted)' }}
                  >
                    {b.f}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-5 mt-3 pt-3 border-t border-[var(--border)] text-[11px]">
        <span className="flex items-center gap-1.5 text-[var(--ink-muted)]">
          <span className="size-2.5 rounded-sm" style={{ background: 'var(--sex-m)' }} /> Hommes
        </span>
        <span className="flex items-center gap-1.5 text-[var(--ink-muted)]">
          <span className="size-2.5 rounded-sm" style={{ background: 'var(--sex-f)' }} /> Femmes
        </span>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface MetricProps { label: string; value: string | number; sub?: string }
function Metric({ label, value, sub }: MetricProps) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 sm:px-4 py-2.5 sm:py-3">
      <div className="text-[10px] sm:text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">{label}</div>
      <div className="text-xl sm:text-2xl font-semibold tabular-nums text-[var(--ink)] mt-1 leading-tight">{value}</div>
      {sub && <div className="text-[10.5px] sm:text-[11px] font-mono text-[var(--ink-faint)] mt-0.5">{sub}</div>}
    </div>
  );
}

interface SectionProps { title: string; children: React.ReactNode }
function Section({ title, children }: SectionProps) {
  return (
    <section>
      <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-3">{title}</div>
      {children}
    </section>
  );
}

interface BarItem { label: string; value: number; color: string }
function BarStack({ items, total }: { items: BarItem[]; total: number }) {
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden border border-[var(--border)]">
        {items.map((it, i) => (
          <div key={i} style={{ width: `${(it.value / total) * 100}%`, background: it.color }} title={`${it.label}: ${it.value}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-xs">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: it.color }} />
            <span className="text-[var(--ink-muted)]">{it.label}</span>
            <span className="font-mono tabular-nums text-[var(--ink)]">{it.value}</span>
            <span className="font-mono text-[var(--ink-faint)]">({total ? ((it.value / total) * 100).toFixed(0) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Histogram({ data, accent }: { data: [number, number][]; accent: string }) {
  const max = Math.max(...data.map((d) => d[1]));
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-end gap-1 h-32">
        {data.map(([decade, count]) => (
          <div key={decade} className="flex-1 h-full flex flex-col items-center justify-end gap-1 group min-w-0">
            <div className="text-[9px] font-mono tabular-nums text-[var(--ink-faint)] opacity-0 group-hover:opacity-100">{count}</div>
            <div
              className="w-full rounded-t transition-opacity hover:opacity-80"
              style={{ height: `${(count / max) * 100}%`, background: accent, minHeight: '2px' }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-2">
        {data.map(([decade], i) => (
          <div key={decade} className="flex-1 text-center text-[9px] font-mono text-[var(--ink-faint)] tabular-nums min-w-0">
            {i % Math.max(1, Math.floor(data.length / 8)) === 0 ? `${decade}s` : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

function NameList({ items, max }: { items: [string, number][]; max: number }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
      {items.map(([name, count], i) => (
        <div key={i} className="px-4 py-2 flex items-center gap-3">
          <div className="text-sm font-medium text-[var(--ink)] w-32 truncate">{name}</div>
          <div className="flex-1 h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(count / max) * 100}%`, background: 'var(--accent)' }} />
          </div>
          <div className="font-mono tabular-nums text-xs text-[var(--ink-muted)] w-6 text-right">{count}</div>
        </div>
      ))}
    </div>
  );
}

interface RecordCardProps { label: string; name: string; value: string | number }
function RecordCard({ label, name, value }: RecordCardProps) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">{label}</div>
      <div className="text-base font-semibold text-[var(--ink)] mt-1 truncate">{name}</div>
      <div className="text-sm font-mono text-[var(--accent)] mt-0.5">{value}</div>
    </div>
  );
}

function CohortLifeExpectancySection({ individuals }: { individuals: Map<string, Individual> }) {
  const data = useMemo(() => computeCohortLifeExpectancy(individuals), [individuals]);
  if (data.length === 0) return null;
  const maxAge = Math.max(...data.map((d) => d.avgAll || 0));
  return (
    <Section title="Espérance de vie par cohorte de naissance">
      <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="space-y-1.5">
          {data.map((d) => (
            <div key={d.decade} className="grid grid-cols-[60px_1fr_60px_60px] gap-3 items-center text-xs">
              <div className="font-mono tabular-nums text-[var(--ink-muted)]">{d.decade}s</div>
              <div className="relative h-5 bg-[var(--bg)] rounded overflow-hidden flex">
                {d.avgM != null && (
                  <div className="h-full" style={{ width: `${(d.avgM / maxAge) * 50}%`, background: 'var(--sex-m)', opacity: 0.7 }} title={`Hommes: ${d.avgM.toFixed(1)} ans (n=${d.countM})`} />
                )}
                {d.avgF != null && (
                  <div className="h-full" style={{ width: `${(d.avgF / maxAge) * 50}%`, background: 'var(--sex-f)', opacity: 0.7 }} title={`Femmes: ${d.avgF.toFixed(1)} ans (n=${d.countF})`} />
                )}
              </div>
              <div className="text-right font-mono tabular-nums text-[var(--ink)]">{d.avgAll?.toFixed(0)} ans</div>
              <div className="text-right font-mono tabular-nums text-[10.5px] text-[var(--ink-faint)]">n={d.countAll}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-3 pt-3 border-t border-[var(--border)] text-[11px] text-[var(--ink-muted)]">
          <span className="flex items-center gap-1"><span className="size-2 rounded" style={{ background: 'var(--sex-m)' }} /> Hommes</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded" style={{ background: 'var(--sex-f)' }} /> Femmes</span>
        </div>
      </div>
    </Section>
  );
}

function DeadBranchesSection({ individuals, families }: { individuals: Map<string, Individual>; families: Map<string, Family> }) {
  const dead = useMemo(() => findDeadBranches(individuals, families), [individuals, families]);
  const interesting = dead.filter((p) => p.birth?.date?.year && p.birth.date.year > 1700);
  const [expanded, setExpanded] = useState(false);
  if (interesting.length === 0) return null;
  return (
    <Section title={`Branches mortes (${interesting.length})`}>
      <div className="text-xs text-[var(--ink-muted)] mb-2">
        Personnes sans descendance enregistrée. Utile pour cibler les recherches qui pourraient en révéler.
      </div>
      <div className="rounded-md border border-[var(--border)] divide-y divide-[var(--border)] max-h-80 overflow-y-auto">
        {(expanded ? interesting : interesting.slice(0, 10)).map((p) => (
          <div key={p.id} className="px-3 py-2 flex items-center justify-between text-sm">
            <span className="text-[var(--ink)] truncate">{p.name.display}</span>
            <span className="text-[11px] font-mono text-[var(--ink-faint)] shrink-0">{formatVital(p)}</span>
          </div>
        ))}
      </div>
      {interesting.length > 10 && (
        <button onClick={() => setExpanded((v) => !v)} className="text-xs text-[var(--accent)] hover:underline mt-2">
          {expanded ? 'Réduire' : `Voir les ${interesting.length - 10} de plus`}
        </button>
      )}
    </Section>
  );
}

// ── Main StatsView ────────────────────────────────────────────────────────────

interface Props {
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
}

export default function StatsView({ individuals, families }: Props) {
  const stats = useMemo(() => {
    const all = Array.from(individuals.values());
    const total = all.length;
    let male = 0, female = 0, unknown = 0;
    let withBirth = 0, withDeath = 0, withBoth = 0;
    let totalLifespan = 0, lifespanCount = 0;
    const surnames = new Map<string, number>();
    const givenNames = new Map<string, number>();
    const birthsByDecade = new Map<number, number>();
    const deathsByDecade = new Map<number, number>();
    let oldest: { person: Individual; span: number } | null = null;
    let youngestBirth: { person: Individual; year: number } | null = null;
    let oldestBirth: { person: Individual; year: number } | null = null;

    for (const p of all) {
      if (p.sex === 'M') male++;
      else if (p.sex === 'F') female++;
      else unknown++;

      const by = p.birth?.date?.year;
      const dy = p.death?.date?.year;
      if (by) withBirth++;
      if (dy) withDeath++;
      if (by && dy) {
        withBoth++;
        const span = dy - by;
        if (span > 0 && span < 130) {
          totalLifespan += span;
          lifespanCount++;
          if (!oldest || span > oldest.span) oldest = { person: p, span };
        }
      }
      if (by) {
        if (!youngestBirth || by > youngestBirth.year) youngestBirth = { person: p, year: by };
        if (!oldestBirth || by < oldestBirth.year) oldestBirth = { person: p, year: by };
        const dec = Math.floor(by / 10) * 10;
        birthsByDecade.set(dec, (birthsByDecade.get(dec) || 0) + 1);
      }
      if (dy) {
        const dec = Math.floor(dy / 10) * 10;
        deathsByDecade.set(dec, (deathsByDecade.get(dec) || 0) + 1);
      }

      if (p.name.surname) surnames.set(p.name.surname, (surnames.get(p.name.surname) || 0) + 1);
      if (p.name.given) {
        const first = p.name.given.split(/\s+/)[0];
        if (first) givenNames.set(first, (givenNames.get(first) || 0) + 1);
      }
    }

    let totalChildren = 0, famCount = 0, maxKids = 0;
    for (const fam of families.values()) {
      if (fam.children?.length) {
        totalChildren += fam.children.length;
        famCount++;
        if (fam.children.length > maxKids) maxKids = fam.children.length;
      }
    }

    return {
      total, male, female, unknown,
      withBirth, withDeath, withBoth,
      avgLifespan: lifespanCount ? totalLifespan / lifespanCount : 0,
      oldest, youngestBirth, oldestBirth,
      surnames: Array.from(surnames.entries()).sort((a, b) => b[1] - a[1]) as [string, number][],
      givenNames: Array.from(givenNames.entries()).sort((a, b) => b[1] - a[1]) as [string, number][],
      birthsByDecade: Array.from(birthsByDecade.entries()).sort((a, b) => a[0] - b[0]) as [number, number][],
      deathsByDecade: Array.from(deathsByDecade.entries()).sort((a, b) => a[0] - b[0]) as [number, number][],
      avgChildren: famCount ? totalChildren / famCount : 0,
      familiesWithChildren: famCount,
      maxKids,
    };
  }, [individuals, families]);

  const totalFams = families.size;

  return (
    <div className="h-full overflow-y-auto mobile-pb-safe">
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-[var(--border)] sticky top-0 z-10 bg-[var(--bg)]">
        <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1">Statistiques</div>
        <h2 className="text-[17px] sm:text-xl font-semibold text-[var(--ink)] tracking-tight">Aperçu de la généalogie</h2>
      </div>

      <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
          <Metric label="Individus" value={stats.total} sub={`${stats.withBoth} avec dates complètes`} />
          <Metric label="Familles" value={totalFams} sub={`${stats.familiesWithChildren} avec enfants`} />
          <Metric label="Espérance moyenne" value={stats.avgLifespan ? `${stats.avgLifespan.toFixed(1)} ans` : '—'} sub={`sur ${stats.withBoth} individus`} />
          <Metric label="Enfants / famille" value={stats.avgChildren ? stats.avgChildren.toFixed(1) : '—'} sub={`max ${stats.maxKids}`} />
        </div>

        <Section title="Répartition par sexe">
          <BarStack items={[
            { label: 'Hommes', value: stats.male, color: 'var(--sex-m)' },
            { label: 'Femmes', value: stats.female, color: 'var(--sex-f)' },
            { label: 'Inconnu', value: stats.unknown, color: 'var(--border-strong)' },
          ]} total={stats.total} />
        </Section>

        {stats.birthsByDecade.length > 0 && (
          <Section title="Naissances par décennie">
            <Histogram data={stats.birthsByDecade} accent="var(--accent)" />
          </Section>
        )}

        {stats.deathsByDecade.length > 0 && (
          <Section title="Décès par décennie">
            <Histogram data={stats.deathsByDecade} accent="var(--ink-muted)" />
          </Section>
        )}

        <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
          {stats.surnames.length > 0 && (
            <Section title={`Patronymes (${stats.surnames.length})`}>
              <NameList items={stats.surnames.slice(0, 10)} max={stats.surnames[0]?.[1] || 1} />
            </Section>
          )}
          {stats.givenNames.length > 0 && (
            <Section title={`Prénoms (${stats.givenNames.length})`}>
              <NameList items={stats.givenNames.slice(0, 10)} max={stats.givenNames[0]?.[1] || 1} />
            </Section>
          )}
        </div>

        <Section title="Records">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {stats.oldest && (
              <RecordCard label="Plus longue vie" name={stats.oldest.person.name.display} value={`${stats.oldest.span} ans`} />
            )}
            {stats.oldestBirth && (
              <RecordCard label="Plus ancienne naissance" name={stats.oldestBirth.person.name.display} value={stats.oldestBirth.year} />
            )}
            {stats.youngestBirth && (
              <RecordCard label="Plus récente naissance" name={stats.youngestBirth.person.name.display} value={stats.youngestBirth.year} />
            )}
          </div>
        </Section>

        <CohortLifeExpectancySection individuals={individuals} />

        <Section title="Pyramide des âges">
          <AgePyramid individuals={individuals} />
        </Section>

        <DeadBranchesSection individuals={individuals} families={families} />
      </div>
    </div>
  );
}
