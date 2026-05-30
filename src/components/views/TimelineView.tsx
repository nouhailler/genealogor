import { useState, useMemo } from 'react';
import type { Individual, Family, GDate } from '@/types/genealogy';
import { HISTORICAL_EVENTS } from '@/lib/historical-events';
import { fromGregorian, format as formatRep, formatYear, isInPeriod } from '@/lib/republican-calendar';
import { Icon } from '@/components/ui-kit';

// ── Types ─────────────────────────────────────────────────────────────────────

type TLEvent =
  | { kind: 'birth' | 'death'; year: number; dateObj: GDate; date: string; place: string; person: Individual }
  | { kind: 'marriage'; year: number; dateObj: GDate; date: string; place: string; husband: Individual | null; wife: Individual | null }
  | { kind: 'historical'; year: number; label: string; icon: string };

type FilterKind = 'all' | 'birth' | 'death' | 'marriage';

// ── Main TimelineView ─────────────────────────────────────────────────────────

interface Props {
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  onNavigate: (id: string) => void;
}

export default function TimelineView({ individuals, families, onNavigate }: Props) {
  const [filter, setFilter] = useState<FilterKind>('all');
  const [showHistorical, setShowHistorical] = useState(true);

  const events = useMemo<TLEvent[]>(() => {
    const list: TLEvent[] = [];
    for (const p of individuals.values()) {
      if (p.birth?.date?.year) {
        list.push({ kind: 'birth', year: p.birth.date.year, dateObj: p.birth.date, date: p.birth.date.display, place: p.birth.place, person: p });
      }
      if (p.death?.date?.year) {
        list.push({ kind: 'death', year: p.death.date.year, dateObj: p.death.date, date: p.death.date.display, place: p.death.place, person: p });
      }
    }
    for (const fam of families.values()) {
      if (fam.marriage?.date?.year) {
        const h = fam.husband ? individuals.get(fam.husband) ?? null : null;
        const w = fam.wife ? individuals.get(fam.wife) ?? null : null;
        list.push({
          kind: 'marriage',
          year: fam.marriage.date.year,
          dateObj: fam.marriage.date,
          date: fam.marriage.date.display,
          place: fam.marriage.place,
          husband: h,
          wife: w,
        });
      }
    }
    return list.sort((a, b) => a.year - b.year);
  }, [individuals, families]);

  const filtered = filter === 'all' ? events : events.filter((e) => e.kind === filter);
  const minYear = filtered.length ? filtered[0].year : 0;
  const maxYear = filtered.length ? filtered[filtered.length - 1].year : 0;

  const groups = useMemo<[number, TLEvent[]][]>(() => {
    const map = new Map<number, TLEvent[]>();
    for (const e of filtered) {
      const decade = Math.floor(e.year / 10) * 10;
      if (!map.has(decade)) map.set(decade, []);
      map.get(decade)!.push(e);
    }
    if (showHistorical) {
      const min = filtered[0]?.year;
      const max = filtered[filtered.length - 1]?.year;
      for (const h of HISTORICAL_EVENTS) {
        if (min != null && max != null && h.year >= min - 5 && h.year <= max + 5) {
          const dec = Math.floor(h.year / 10) * 10;
          if (!map.has(dec)) map.set(dec, []);
          const histEvent: TLEvent = { kind: 'historical', year: h.year, label: h.label, icon: h.icon };
          map.get(dec)!.push(histEvent);
        }
      }
    }
    for (const arr of map.values()) arr.sort((a, b) => a.year - b.year);
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filtered, showHistorical]);

  const kindMeta = {
    birth: { label: 'Naissance', icon: Icon.Calendar, color: 'var(--sex-m)' },
    death: { label: 'Décès', icon: Icon.Cross, color: 'var(--ink-muted)' },
    marriage: { label: 'Mariage', icon: Icon.Heart, color: 'var(--sex-f)' },
  };

  const filterOptions: [FilterKind, string][] = [
    ['all', 'Tous'],
    ['birth', 'Naissances'],
    ['marriage', 'Mariages'],
    ['death', 'Décès'],
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-[var(--border)] flex flex-col gap-3 shrink-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1">Frise chronologique</div>
            <h2 className="text-[17px] sm:text-xl font-semibold text-[var(--ink)] tracking-tight">
              {filtered.length} événement{filtered.length > 1 ? 's' : ''}
              {filtered.length > 0 && (
                <span className="font-mono font-normal text-[var(--ink-faint)] text-xs sm:text-sm ml-2">{minYear} → {maxYear}</span>
              )}
            </h2>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)] cursor-pointer select-none shrink-0">
            <input type="checkbox" checked={showHistorical} onChange={(e) => setShowHistorical(e.target.checked)} />
            Contexte hist.
          </label>
        </div>
        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 sm:-mx-6 px-4 sm:px-6">
          {filterOptions.map(([k, label]) => {
            const isActive = filter === k;
            return (
              <button
                key={k}
                onClick={() => setFilter(k)}
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

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-6 mobile-pb-safe">
        {groups.length === 0 ? (
          <div className="text-sm text-[var(--ink-faint)] italic">Aucun événement daté.</div>
        ) : (
          <div className="relative">
            <div className="absolute left-[52px] sm:left-[68px] top-0 bottom-0 w-px bg-[var(--border)]" />
            <div className="space-y-6 sm:space-y-8">
              {groups.map(([decade, items]) => (
                <div key={decade} className="relative">
                  <div className="flex items-baseline gap-3 sm:gap-4 mb-3">
                    <div className="w-[44px] sm:w-[60px] text-right">
                      <div className="text-sm sm:text-base font-semibold tabular-nums text-[var(--ink)]">{decade}s</div>
                    </div>
                    <div className="size-2 rounded-full bg-[var(--accent)] -ml-[5px] relative z-10" />
                    <div className="text-[10.5px] sm:text-[11px] font-mono text-[var(--ink-faint)]">{items.length} événement{items.length > 1 ? 's' : ''}</div>
                  </div>
                  <div className="ml-[60px] sm:ml-[80px] space-y-1.5">
                    {items.map((e, i) => {
                      if (e.kind === 'historical') {
                        return (
                          <div key={'h' + i} className="flex items-start gap-3 my-1.5 py-1 px-2.5 rounded"
                            style={{ background: 'color-mix(in oklch, var(--warn) 8%, transparent)', borderLeft: '2px solid var(--warn)' }}>
                            <div className="text-[11px] font-mono tabular-nums text-[var(--warn)] shrink-0 w-12 pt-0.5">{e.year}</div>
                            <div className="text-base shrink-0 leading-none" style={{ marginTop: 1 }}>{e.icon}</div>
                            <div className="text-sm font-medium text-[var(--ink)]" style={{ fontStyle: 'italic' }}>{e.label}</div>
                          </div>
                        );
                      }
                      const meta = kindMeta[e.kind as 'birth' | 'death' | 'marriage'];
                      const repText = (() => {
                        if (!isInPeriod(e.year)) return null;
                        const rep = fromGregorian(e.dateObj.year!, e.dateObj.month!, e.dateObj.day!);
                        return rep ? formatRep(rep, { short: true }) : formatYear(e.year);
                      })();
                      return (
                        <div key={i} className="flex items-start gap-3 group">
                          <div className="text-[11px] font-mono tabular-nums text-[var(--ink-faint)] shrink-0 w-12 pt-1.5">{e.year}</div>
                          <div className="size-1 rounded-full mt-2.5 shrink-0" style={{ background: meta.color }} />
                          <div className="min-w-0 flex-1 py-1 px-2.5 rounded hover:bg-[var(--surface-hover)] transition-colors">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">{meta.label}</span>
                              <span className="text-sm text-[var(--ink)]">
                                {e.kind === 'marriage' ? (
                                  <>
                                    <button onClick={() => e.husband && onNavigate(e.husband.id)} className="font-medium hover:text-[var(--accent)]">{e.husband?.name.display || '?'}</button>
                                    <span className="text-[var(--ink-faint)]"> × </span>
                                    <button onClick={() => e.wife && onNavigate(e.wife.id)} className="font-medium hover:text-[var(--accent)]">{e.wife?.name.display || '?'}</button>
                                  </>
                                ) : (
                                  <button onClick={() => onNavigate(e.person.id)} className="font-medium hover:text-[var(--accent)]">{e.person.name.display}</button>
                                )}
                              </span>
                            </div>
                            {(e.date || e.place) && (
                              <div className="text-xs text-[var(--ink-muted)] mt-0.5">
                                {e.date}{e.date && e.place ? ' · ' : ''}{e.place}
                                {repText && <span className="ml-2 font-mono" style={{ color: 'color-mix(in oklch, var(--warn) 80%, var(--ink-faint))' }}>· {repText}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
