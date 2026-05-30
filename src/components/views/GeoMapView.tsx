import { useRef, useEffect, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Individual, Family } from '@/types/genealogy';

// ── Constants ─────────────────────────────────────────────────────────────────

const GEOMAP_PALETTE = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

// ── Types ─────────────────────────────────────────────────────────────────────

type MapMode = 'points' | 'migrations' | 'heatmap' | 'surnames';

interface Coord { lat: number; lon: number }

interface GeoEvent {
  kind: 'birth' | 'death' | 'marriage';
  place: string;
  year: number | null | undefined;
  person: Individual | null;
  partner?: Individual | null;
}

interface MigrationStop {
  kind: 'birth' | 'death' | 'marriage';
  place: string;
  year: number | null | undefined;
}

interface MigrationPath {
  person: Individual;
  stops: MigrationStop[];
}

// ── Main GeoMapView ───────────────────────────────────────────────────────────

interface Props {
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  onNavigate: (id: string) => void;
}

export default function GeoMapView({ individuals, families, onNavigate: _onNavigate }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [geocoded, setGeocoded] = useState<Map<string, Coord>>(new Map());
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });
  const [mode, setMode] = useState<MapMode>('points');
  const [activeDecade, setActiveDecade] = useState<number | null>(null);
  const [migPlayProgress, setMigPlayProgress] = useState(1);
  const playRafRef = useRef<number | null>(null);
  const playStartRef = useRef<number | null>(null);

  const events = useMemo<GeoEvent[]>(() => {
    const list: GeoEvent[] = [];
    for (const p of individuals.values()) {
      if (p.birth?.place) list.push({ kind: 'birth', place: p.birth.place, year: p.birth.date?.year, person: p });
      if (p.death?.place) list.push({ kind: 'death', place: p.death.place, year: p.death.date?.year, person: p });
    }
    for (const f of families.values()) {
      if (f.marriage?.place) {
        const h = f.husband ? individuals.get(f.husband) ?? null : null;
        const w = f.wife ? individuals.get(f.wife) ?? null : null;
        list.push({ kind: 'marriage', place: f.marriage.place, year: f.marriage.date?.year, person: h, partner: w });
      }
    }
    return list;
  }, [individuals, families]);

  const uniquePlaces = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const e of events) set.add(e.place);
    return Array.from(set);
  }, [events]);

  const yearBounds = useMemo(() => {
    const years = events.map((e) => e.year).filter((y): y is number => y != null);
    if (years.length === 0) return null;
    return { min: Math.min(...years), max: Math.max(...years) };
  }, [events]);

  const migrations = useMemo<MigrationPath[]>(() => {
    const paths: MigrationPath[] = [];
    for (const p of individuals.values()) {
      const stops: MigrationStop[] = [];
      if (p.birth?.place) stops.push({ kind: 'birth', place: p.birth.place, year: p.birth.date?.year });
      for (const fid of p.fams || []) {
        const fam = families.get(fid);
        if (fam?.marriage?.place) stops.push({ kind: 'marriage', place: fam.marriage.place, year: fam.marriage.date?.year });
      }
      if (p.death?.place) stops.push({ kind: 'death', place: p.death.place, year: p.death.date?.year });
      const dedup = stops.filter((s, i) => i === 0 || s.place !== stops[i - 1].place);
      if (dedup.length >= 2) paths.push({ person: p, stops: dedup });
    }
    return paths;
  }, [individuals, families]);

  const surnameColors = useMemo(() => {
    const tally = new Map<string, number>();
    for (const p of individuals.values()) {
      const s = (p.name.surname || '').trim();
      if (!s) continue;
      tally.set(s, (tally.get(s) || 0) + 1);
    }
    const sorted = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const m = new Map<string, { color: string; count: number }>();
    sorted.forEach(([s], i) => m.set(s, { color: GEOMAP_PALETTE[i % GEOMAP_PALETTE.length], count: tally.get(s)! }));
    return m;
  }, [individuals]);

  const decadeRange = useMemo<number[] | null>(() => {
    if (!yearBounds) return null;
    const minDec = Math.floor(yearBounds.min / 10) * 10;
    const maxDec = Math.floor(yearBounds.max / 10) * 10;
    const out: number[] = [];
    for (let d = minDec; d <= maxDec; d += 10) out.push(d);
    return out;
  }, [yearBounds]);

  // Init Leaflet map
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: true }).setView([46.6, 2.5], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap', maxZoom: 18,
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
  }, []);

  // Pick sensible initial decade
  useEffect(() => {
    if (activeDecade != null) return;
    if (!decadeRange || decadeRange.length === 0) return;
    setActiveDecade(decadeRange[Math.floor(decadeRange.length / 2)]);
  }, [decadeRange, activeDecade]);

  // Geocode places via Nominatim
  useEffect(() => {
    let cancelled = false;
    async function go() {
      setLoading(true);
      const cache: Record<string, Coord> = JSON.parse(localStorage.getItem('genealogor.geocache') || '{}');
      const out = new Map<string, Coord>();
      for (const place of uniquePlaces) {
        if (cancelled) break;
        if (cache[place]) { out.set(place, cache[place]); continue; }
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place)}`);
          const json = await res.json() as Array<{ lat: string; lon: string }>;
          if (json[0]) {
            const coord: Coord = { lat: parseFloat(json[0].lat), lon: parseFloat(json[0].lon) };
            cache[place] = coord;
            out.set(place, coord);
          }
        } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 1100));
      }
      if (!cancelled) {
        localStorage.setItem('genealogor.geocache', JSON.stringify(cache));
        setGeocoded(out);
        setLoading(false);
      }
    }
    if (uniquePlaces.length > 0) go();
    return () => { cancelled = true; };
  }, [uniquePlaces.length]); // use length to avoid string concatenation on each render

  // Render markers
  useEffect(() => {
    if (!layerRef.current) return;
    layerRef.current.clearLayers();

    const inPeriod = (year: number | null | undefined) => {
      if (period.min && year && year < period.min) return false;
      if (period.max && year && year > period.max) return false;
      return true;
    };

    if (mode === 'points') {
      const grouped = new Map<string, { coord: Coord; place: string; events: GeoEvent[] }>();
      for (const e of events) {
        if (!inPeriod(e.year)) continue;
        const c = geocoded.get(e.place);
        if (!c) continue;
        const k = `${c.lat},${c.lon}`;
        if (!grouped.has(k)) grouped.set(k, { coord: c, place: e.place, events: [] });
        grouped.get(k)!.events.push(e);
      }
      const maxCount = Math.max(1, ...Array.from(grouped.values()).map((g) => g.events.length));
      for (const g of grouped.values()) {
        const r = 6 + (g.events.length / maxCount) * 14;
        const marker = L.circleMarker([g.coord.lat, g.coord.lon], {
          radius: r, fillColor: '#6366f1', color: '#4338ca', weight: 1, fillOpacity: 0.6,
        }).addTo(layerRef.current!);
        const names = g.events.slice(0, 8).map((e) => `<div>· ${e.person?.name?.display || '?'} (${e.kind === 'birth' ? 'n.' : e.kind === 'death' ? '†' : '×'} ${e.year || ''})</div>`).join('');
        marker.bindPopup(`<div style="font-family:Inter"><strong>${g.place}</strong><br><small>${g.events.length} événement${g.events.length > 1 ? 's' : ''}</small>${names}</div>`);
      }
    }

    if (mode === 'heatmap' && activeDecade != null) {
      const grouped = new Map<string, { coord: Coord; place: string; events: GeoEvent[] }>();
      for (const e of events) {
        if (e.year == null) continue;
        if (e.year < activeDecade || e.year > activeDecade + 9) continue;
        const c = geocoded.get(e.place);
        if (!c) continue;
        const k = `${c.lat},${c.lon}`;
        if (!grouped.has(k)) grouped.set(k, { coord: c, place: e.place, events: [] });
        grouped.get(k)!.events.push(e);
      }
      const maxCount = Math.max(1, ...Array.from(grouped.values()).map((g) => g.events.length));
      for (const g of grouped.values()) {
        const intensity = g.events.length / maxCount;
        const r = 8 + intensity * 22;
        L.circleMarker([g.coord.lat, g.coord.lon], { radius: r * 1.6, fillColor: '#f97316', color: 'transparent', fillOpacity: 0.12 }).addTo(layerRef.current!);
        L.circleMarker([g.coord.lat, g.coord.lon], { radius: r * 1.1, fillColor: '#f97316', color: 'transparent', fillOpacity: 0.22 }).addTo(layerRef.current!);
        const marker = L.circleMarker([g.coord.lat, g.coord.lon], { radius: r, fillColor: '#dc2626', color: '#7f1d1d', weight: 1, fillOpacity: 0.7 }).addTo(layerRef.current!);
        marker.bindPopup(`<div style="font-family:Inter"><strong>${g.place}</strong><br><small>Décennie ${activeDecade}: ${g.events.length} événement${g.events.length > 1 ? 's' : ''}</small></div>`);
      }
    }

    if (mode === 'migrations') {
      interface Segment {
        person: Individual;
        from: Coord;
        to: Coord;
        year: number | null | undefined;
        fromKind: string;
        toKind: string;
      }
      const allSegments: Segment[] = [];
      for (const path of migrations) {
        const years = path.stops.map((s) => s.year).filter((y): y is number => y != null);
        const avgYear = years.length ? years.reduce((a, b) => a + b, 0) / years.length : null;
        if (!inPeriod(avgYear)) continue;
        for (let i = 0; i < path.stops.length - 1; i++) {
          const a = geocoded.get(path.stops[i].place);
          const b = geocoded.get(path.stops[i + 1].place);
          if (!a || !b) continue;
          allSegments.push({
            person: path.person,
            from: a, to: b,
            year: path.stops[i + 1].year ?? path.stops[i].year ?? avgYear,
            fromKind: path.stops[i].kind,
            toKind: path.stops[i + 1].kind,
          });
        }
      }
      allSegments.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
      const cutoff = Math.ceil(allSegments.length * migPlayProgress);
      const visible = allSegments.slice(0, cutoff);

      const colorFor = (y: number | null | undefined) => {
        if (!y) return '#6366f1';
        const c = Math.floor(y / 100);
        const palette = ['#312e81', '#1e40af', '#0e7490', '#15803d', '#a16207', '#b91c1c', '#9d174d', '#6b21a8'];
        return palette[c % palette.length];
      };

      for (const seg of visible) {
        const color = colorFor(seg.year);
        L.polyline([[seg.from.lat, seg.from.lon], [seg.to.lat, seg.to.lon]], { color, weight: 1.6, opacity: 0.65 }).addTo(layerRef.current!);
        const midLat = (seg.from.lat + seg.to.lat) / 2;
        const midLon = (seg.from.lon + seg.to.lon) / 2;
        const angle = Math.atan2(seg.to.lat - seg.from.lat, seg.to.lon - seg.from.lon) * 180 / Math.PI;
        const icon = L.divIcon({
          html: `<div style="transform: rotate(${-angle}deg); color: ${color}; font-size: 14px; line-height: 1;">▶</div>`,
          className: 'migration-arrow', iconSize: [12, 12], iconAnchor: [6, 6],
        });
        L.marker([midLat, midLon], { icon, interactive: false }).addTo(layerRef.current!);
      }
      const stopPoints = new Map<string, { coord: Coord; kinds: Set<string> }>();
      for (const seg of visible) {
        const ak = `${seg.from.lat},${seg.from.lon}`;
        const bk = `${seg.to.lat},${seg.to.lon}`;
        if (!stopPoints.has(ak)) stopPoints.set(ak, { coord: seg.from, kinds: new Set() });
        stopPoints.get(ak)!.kinds.add(seg.fromKind);
        if (!stopPoints.has(bk)) stopPoints.set(bk, { coord: seg.to, kinds: new Set() });
        stopPoints.get(bk)!.kinds.add(seg.toKind);
      }
      for (const sp of stopPoints.values()) {
        L.circleMarker([sp.coord.lat, sp.coord.lon], { radius: 4, fillColor: '#374151', color: '#111827', weight: 1, fillOpacity: 0.95 }).addTo(layerRef.current!);
      }
    }

    if (mode === 'surnames') {
      const grouped = new Map<string, { coord: Coord; place: string; surname: string; count: number; color: string }>();
      for (const e of events) {
        if (!inPeriod(e.year)) continue;
        const c = geocoded.get(e.place);
        if (!c) continue;
        const s = e.person?.name?.surname?.trim();
        if (!s) continue;
        const entry = surnameColors.get(s);
        if (!entry) continue;
        const k = `${c.lat},${c.lon},${s}`;
        if (!grouped.has(k)) grouped.set(k, { coord: c, place: e.place, surname: s, count: 0, color: entry.color });
        grouped.get(k)!.count++;
      }
      for (const g of grouped.values()) {
        const r = 5 + Math.min(g.count, 12);
        const m = L.circleMarker([g.coord.lat, g.coord.lon], { radius: r, fillColor: g.color, color: g.color, weight: 1, fillOpacity: 0.65 }).addTo(layerRef.current!);
        m.bindPopup(`<div style="font-family:Inter"><strong>${g.surname}</strong> à ${g.place}<br><small>${g.count} événement${g.count > 1 ? 's' : ''}</small></div>`);
      }
    }
  }, [geocoded, period.min, period.max, events, mode, activeDecade, migPlayProgress, migrations, surnameColors]);

  const playMigrations = () => {
    if (playRafRef.current) cancelAnimationFrame(playRafRef.current);
    playStartRef.current = performance.now();
    setMigPlayProgress(0);
    const duration = 4500;
    const tick = (t: number) => {
      const elapsed = t - (playStartRef.current ?? t);
      const p = Math.min(1, elapsed / duration);
      setMigPlayProgress(p);
      if (p < 1) playRafRef.current = requestAnimationFrame(tick);
    };
    playRafRef.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => { if (playRafRef.current) cancelAnimationFrame(playRafRef.current); }, []);

  const modes: [MapMode, string][] = [
    ['points', 'Points'],
    ['migrations', 'Migrations'],
    ['heatmap', 'Heatmap'],
    ['surnames', 'Patronymes'],
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-[var(--border)] flex flex-col gap-3 shrink-0">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="min-w-0">
            <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1">Cartographie · OpenStreetMap</div>
            <h2 className="text-[17px] sm:text-xl font-semibold text-[var(--ink)] tracking-tight">
              {geocoded.size}/{uniquePlaces.length} lieux géocodés
              {loading && <span className="text-[11px] font-mono text-[var(--accent)] ml-2">géocodage…</span>}
            </h2>
          </div>
          {yearBounds && mode !== 'heatmap' && (
            <div className="flex items-center gap-2 text-xs shrink-0">
              <span className="font-mono text-[var(--ink-faint)]">Période</span>
              <input type="number" inputMode="numeric" placeholder={String(yearBounds.min)} value={period.min ?? ''}
                onChange={(e) => setPeriod((p) => ({ ...p, min: e.target.value ? parseInt(e.target.value) : null }))}
                className="w-[68px] sm:w-20 h-9 sm:h-7 px-2 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] text-xs" />
              <span className="text-[var(--ink-faint)]">→</span>
              <input type="number" inputMode="numeric" placeholder={String(yearBounds.max)} value={period.max ?? ''}
                onChange={(e) => setPeriod((p) => ({ ...p, max: e.target.value ? parseInt(e.target.value) : null }))}
                className="w-[68px] sm:w-20 h-9 sm:h-7 px-2 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] text-xs" />
            </div>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 sm:-mx-6 px-4 sm:px-6">
          {modes.map(([k, label]) => {
            const isActive = mode === k;
            return (
              <button
                key={k}
                onClick={() => setMode(k)}
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
      <div ref={containerRef} className="flex-1 relative" style={{ minHeight: 280 }}>
        {mode === 'heatmap' && decadeRange && activeDecade != null && (
          <div className="absolute left-3 right-3 sm:left-4 sm:right-4 bottom-3 z-[400] pointer-events-auto rounded-lg p-3 shadow-lg"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">Décennie</span>
              <span className="text-base font-semibold tabular-nums text-[var(--ink)]">{activeDecade}s</span>
            </div>
            <input
              type="range"
              min={decadeRange[0]}
              max={decadeRange[decadeRange.length - 1]}
              step={10}
              value={activeDecade}
              onChange={(e) => setActiveDecade(parseInt(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
            <div className="flex justify-between mt-1 text-[10px] font-mono text-[var(--ink-faint)] tabular-nums">
              <span>{decadeRange[0]}</span>
              <span>{decadeRange[decadeRange.length - 1] + 9}</span>
            </div>
          </div>
        )}

        {mode === 'migrations' && (
          <div className="absolute left-3 sm:left-4 bottom-3 z-[400] pointer-events-auto rounded-lg p-2 flex items-center gap-2 shadow-lg"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <button
              onClick={playMigrations}
              className="size-9 grid place-items-center rounded-full active:opacity-70"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              title="Rejouer l'animation"
              aria-label="Rejouer l'animation"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="6,4 20,12 6,20" /></svg>
            </button>
            <div className="text-[11px] font-mono text-[var(--ink-muted)] pr-2">
              {migPlayProgress < 1 ? `${Math.round(migPlayProgress * 100)}%` : `${migrations.length} parcours`}
            </div>
          </div>
        )}

        {mode === 'surnames' && surnameColors.size > 0 && (
          <div className="absolute right-3 top-3 z-[400] pointer-events-auto rounded-lg p-3 shadow-lg max-w-[200px]"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-2">
              Patronymes (top {surnameColors.size})
            </div>
            <div className="space-y-1 max-h-[40vh] overflow-y-auto">
              {Array.from(surnameColors.entries()).map(([surname, { color, count }]) => (
                <div key={surname} className="flex items-center gap-2 text-[11px]">
                  <span className="size-2.5 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-[var(--ink)] truncate flex-1">{surname}</span>
                  <span className="font-mono text-[var(--ink-faint)] tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
