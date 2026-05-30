import { useState, useMemo } from 'react';
import type { Individual, Family } from '@/types/genealogy';
import { Icon } from '@/components/ui-kit';

// ── Types ─────────────────────────────────────────────────────────────────────

type EventKind = 'birth' | 'death' | 'marriage';

interface PlaceEvent {
  kind: EventKind;
  person: Individual | null;
  partner: Individual | null;
}

interface PlaceEntry {
  name: string;
  events: PlaceEvent[];
  people: Set<string>;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PlaceDetail({ place, onSelect }: { place: PlaceEntry | undefined; onSelect: (id: string) => void }) {
  if (!place) return null;
  const grouped: Record<EventKind, PlaceEvent[]> = { birth: [], death: [], marriage: [] };
  for (const e of place.events) grouped[e.kind].push(e);
  const kindLabel: Record<EventKind, string> = { birth: 'Naissances', death: 'Décès', marriage: 'Mariages' };

  return (
    <div className="space-y-4">
      {(Object.entries(grouped) as [EventKind, PlaceEvent[]][]).map(([kind, items]) => items.length > 0 && (
        <div key={kind}>
          <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-2">
            {kindLabel[kind]} ({items.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {items.map((e, i) => (
              <button
                key={i}
                onClick={() => {
                  const id = e.person?.id || e.partner?.id;
                  if (id) onSelect(id);
                }}
                className="text-xs px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--accent)] text-[var(--ink)]"
              >
                {kind === 'marriage'
                  ? `${e.person?.name.display || '?'} × ${e.partner?.name.display || '?'}`
                  : e.person?.name.display || '?'}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main PlacesView ───────────────────────────────────────────────────────────

interface Props {
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  onNavigate: (id: string) => void;
}

export default function PlacesView({ individuals, families, onNavigate }: Props) {
  const places = useMemo<PlaceEntry[]>(() => {
    const map = new Map<string, PlaceEntry>();
    const add = (place: string | undefined, kind: EventKind, person: Individual | null, partner: Individual | null = null) => {
      if (!place) return;
      const key = place.trim();
      if (!map.has(key)) map.set(key, { name: key, events: [], people: new Set() });
      const entry = map.get(key)!;
      entry.events.push({ kind, person, partner });
      if (person) entry.people.add(person.id);
      if (partner) entry.people.add(partner.id);
    };
    for (const p of individuals.values()) {
      if (p.birth?.place) add(p.birth.place, 'birth', p);
      if (p.death?.place) add(p.death.place, 'death', p);
    }
    for (const fam of families.values()) {
      if (fam.marriage?.place) {
        const h = fam.husband ? individuals.get(fam.husband) ?? null : null;
        const w = fam.wife ? individuals.get(fam.wife) ?? null : null;
        add(fam.marriage.place, 'marriage', h, w);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.events.length - a.events.length);
  }, [individuals, families]);

  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const max = places[0]?.events.length || 1;
  const isMobile = window.innerWidth < 768;

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-[var(--border)] shrink-0">
        <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1">Carte des lieux</div>
        <h2 className="text-[17px] sm:text-xl font-semibold text-[var(--ink)] tracking-tight">
          {places.length} lieu{places.length > 1 ? 'x' : ''} référencé{places.length > 1 ? 's' : ''}
        </h2>
        <div className="text-[11px] font-mono text-[var(--ink-faint)] mt-1">
          Taille proportionnelle au nombre d'événements
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 mobile-pb-safe">
        {places.length === 0 ? (
          <div className="text-sm text-[var(--ink-faint)] italic">Aucun lieu renseigné.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
            {/* Bubble cloud */}
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 min-h-[260px] md:min-h-[400px]">
              <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-3 sm:mb-4">Vue d'ensemble</div>
              <div className="flex flex-wrap gap-2 items-center justify-center">
                {places.map((p, i) => {
                  const ratio = p.events.length / max;
                  const fontSize = (isMobile ? 11 : 11) + ratio * (isMobile ? 10 : 14);
                  const padding = (isMobile ? 5 : 6) + ratio * (isMobile ? 6 : 8);
                  const isSelected = selectedPlace === p.name;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedPlace(isSelected ? null : p.name)}
                      className={`rounded-full font-medium transition-all active:opacity-70 ${
                        isSelected
                          ? 'bg-[var(--accent)] text-white border border-[var(--accent)]'
                          : 'bg-[var(--bg)] border border-[var(--border)] text-[var(--ink)] hover:border-[var(--accent)]'
                      }`}
                      style={{ fontSize: `${fontSize}px`, padding: `${padding}px ${padding * 1.6}px` }}
                    >
                      {p.name.split(',')[0]}
                      <span className="ml-1.5 font-mono text-[0.75em] opacity-70">{p.events.length}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detail */}
            <div className={`rounded-md border border-[var(--border)] bg-[var(--surface)] ${!selectedPlace ? 'hidden md:block' : ''}`}>
              <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-[var(--border)] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1">Détail</div>
                  <div className="text-sm sm:text-base font-semibold text-[var(--ink)] flex items-center gap-2 truncate">
                    <Icon.MapPin className="size-4 text-[var(--accent)] shrink-0" />
                    <span className="truncate">{selectedPlace || 'Sélectionnez un lieu'}</span>
                  </div>
                </div>
                {selectedPlace && (
                  <button
                    onClick={() => setSelectedPlace(null)}
                    className="md:hidden size-8 grid place-items-center rounded-full text-[var(--ink-faint)] active:bg-[var(--surface-hover)] shrink-0"
                    aria-label="Fermer"
                  >
                    <Icon.X className="size-4" />
                  </button>
                )}
              </div>
              <div className="p-4 sm:p-5 max-h-[60vh] md:max-h-[480px] overflow-y-auto">
                {selectedPlace ? (
                  <PlaceDetail place={places.find((p) => p.name === selectedPlace)} onSelect={onNavigate} />
                ) : (
                  <div className="text-sm text-[var(--ink-faint)] italic">
                    Cliquez sur un lieu à gauche pour voir les événements associés.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {places.length > 0 && (
          <div className="mt-5 sm:mt-6">
            <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-2 sm:mb-3">Tous les lieux</div>
            <div className="rounded-md border border-[var(--border)] divide-y divide-[var(--border)]">
              {places.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedPlace(p.name)}
                  className={`w-full text-left px-4 py-3 sm:py-2.5 flex items-center justify-between gap-2 active:bg-[var(--surface-hover)] hover:bg-[var(--surface-hover)] ${
                    selectedPlace === p.name ? 'bg-[var(--accent-soft)]' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon.MapPin className="size-3.5 text-[var(--ink-faint)] shrink-0" />
                    <span className="text-sm text-[var(--ink)] truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-[11px] font-mono text-[var(--ink-faint)]">
                    <span>{p.people.size} pers.</span>
                    <span>{p.events.length} év.</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
