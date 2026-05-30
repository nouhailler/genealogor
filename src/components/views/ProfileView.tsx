import { useState, useEffect } from 'react';
import type { Individual, Family, GDate } from '@/types/genealogy';
import { Icon, formatVital, sexLabel, sexColor } from '@/components/ui-kit';
import { isInPeriod, fromGregorian, format as formatRep, formatYear } from '@/lib/republican-calendar';
import { shouldMask } from '@/lib/privacy';

// ── Sub-components ────────────────────────────────────────────────────────────

function FactSourceBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span
      className="ml-2 inline-flex items-center gap-1 text-[10.5px] font-mono"
      style={{ background: 'color-mix(in oklch, var(--accent) 14%, transparent)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 999 }}
      title={`${count} pièce${count > 1 ? 's' : ''} ancrée${count > 1 ? 's' : ''} sur ce fait`}
    >
      <Icon.Paperclip style={{ width: 9, height: 9 }} />
      {count}
    </span>
  );
}

interface FieldProps { icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement; label: string; badge?: React.ReactNode; children: React.ReactNode }
function Field({ icon: I, label, badge, children }: FieldProps) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <I className="size-4 mt-0.5 text-[var(--ink-faint)] shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] flex items-center">
          <span>{label}</span>
          {badge}
        </div>
        <div className="text-sm text-[var(--ink)] mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function RepublicanBadge({ date }: { date: GDate | undefined | null }) {
  if (!date || !isInPeriod(date.year)) return null;
  const rep = date.year && date.month && date.day ? fromGregorian(date.year, date.month, date.day) : null;
  const text = rep ? formatRep(rep) : (date.year ? formatYear(date.year) : null);
  if (!text) return null;
  return (
    <div className="mt-1 inline-flex items-center gap-1.5 text-[10.5px] font-mono" style={{ color: 'color-mix(in oklch, var(--warn) 80%, var(--ink-faint))' }}>
      <span style={{ background: 'color-mix(in oklch, var(--warn) 18%, transparent)', borderRadius: 3, padding: '1px 6px', letterSpacing: 0.2 }}>Rép.</span>
      <span className="italic">{text}</span>
    </div>
  );
}

function PersonChip({ person, onClick, dim = false }: { person: Individual | null | undefined; onClick?: (id: string) => void; dim?: boolean }) {
  if (!person) {
    return <div className="rounded-md border border-dashed border-[var(--border)] px-3 py-2 text-xs font-mono text-[var(--ink-faint)] text-center min-w-[120px]">inconnu</div>;
  }
  const masked = shouldMask(person);
  return (
    <button
      onClick={() => onClick?.(person.id)}
      className={`group text-left rounded-md border bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] transition-colors px-3 py-2 min-w-[140px] max-w-[200px] ${dim ? 'opacity-90' : ''}`}
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-2">
        <span className="size-1.5 rounded-full shrink-0" style={{ background: sexColor(person.sex) }} />
        <span className={`text-sm font-medium text-[var(--ink)] truncate ${masked ? 'is-private' : ''}`}>{person.name.display}</span>
      </div>
      <div className={`text-[11px] font-mono text-[var(--ink-faint)] mt-0.5 pl-3.5 ${masked ? 'is-private' : ''}`}>{formatVital(person)}</div>
    </button>
  );
}

function RelationGroup({ label, people, onSelect }: { label: string; people: Individual[]; onSelect?: (id: string) => void }) {
  if (!people || people.length === 0) return null;
  return (
    <div className="mb-4 last:mb-0">
      <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">
        {people.map((p) => <PersonChip key={p.id} person={p} onClick={onSelect} />)}
      </div>
    </div>
  );
}

function AncestorTree({ person, individuals, families, onSelect }: { person: Individual; individuals: Map<string, Individual>; families: Map<string, Family>; onSelect?: (id: string) => void }) {
  function getParents(p: Individual | null | undefined): { father: Individual | null; mother: Individual | null } {
    if (!p?.famc?.length) return { father: null, mother: null };
    const fam = families.get(p.famc[0]);
    if (!fam) return { father: null, mother: null };
    return {
      father: fam.husband ? (individuals.get(fam.husband) ?? null) : null,
      mother: fam.wife ? (individuals.get(fam.wife) ?? null) : null,
    };
  }
  const { father, mother } = getParents(person);
  const fGP = getParents(father);
  const mGP = getParents(mother);

  return (
    <div className="relative">
      <div className="grid grid-cols-3 gap-x-6 gap-y-4 items-center">
        <div className="flex flex-col gap-2">
          <PersonChip person={fGP.father} onClick={onSelect} />
          <PersonChip person={fGP.mother} onClick={onSelect} />
          <div className="h-2" />
          <PersonChip person={mGP.father} onClick={onSelect} />
          <PersonChip person={mGP.mother} onClick={onSelect} />
        </div>
        <div className="flex flex-col gap-12 relative">
          <svg className="absolute -left-6 top-0 h-full w-6 pointer-events-none" preserveAspectRatio="none">
            <line x1="0" y1="14%" x2="24" y2="22%" stroke="var(--border-strong)" strokeWidth="1" />
            <line x1="0" y1="36%" x2="24" y2="22%" stroke="var(--border-strong)" strokeWidth="1" />
            <line x1="0" y1="64%" x2="24" y2="78%" stroke="var(--border-strong)" strokeWidth="1" />
            <line x1="0" y1="86%" x2="24" y2="78%" stroke="var(--border-strong)" strokeWidth="1" />
          </svg>
          <PersonChip person={father} onClick={onSelect} />
          <PersonChip person={mother} onClick={onSelect} />
        </div>
        <div className="relative">
          <svg className="absolute -left-6 top-0 h-full w-6 pointer-events-none" preserveAspectRatio="none">
            <line x1="0" y1="25%" x2="24" y2="50%" stroke="var(--border-strong)" strokeWidth="1" />
            <line x1="0" y1="75%" x2="24" y2="50%" stroke="var(--border-strong)" strokeWidth="1" />
          </svg>
          <div className="rounded-md border-2 px-3 py-2 min-w-[140px] max-w-[200px]" style={{ borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}>
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
              <span className="text-sm font-semibold text-[var(--ink)] truncate">{person.name.display}</span>
            </div>
            <div className="text-[11px] font-mono text-[var(--ink-faint)] mt-0.5 pl-3.5">{formatVital(person)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonalTimeline({ person, families, individuals }: { person: Individual; families: Map<string, Family>; individuals: Map<string, Individual> }) {
  const events: { year: number; label: string; detail: string; iconKey: keyof typeof Icon }[] = [];
  if (person.birth?.date?.year) events.push({ year: person.birth.date.year, label: 'Naissance', detail: person.birth.place || '', iconKey: 'Calendar' });
  for (const fid of person.fams || []) {
    const fam = families.get(fid);
    if (!fam) continue;
    if (fam.marriage?.date?.year) {
      const partnerId = fam.husband === person.id ? fam.wife : fam.husband;
      const partner = partnerId ? individuals.get(partnerId) : null;
      events.push({ year: fam.marriage.date.year, label: `Mariage${partner ? ` avec ${partner.name.display}` : ''}`, detail: fam.marriage.place || '', iconKey: 'Heart' });
    }
    for (const cid of fam.children || []) {
      const child = individuals.get(cid);
      if (child?.birth?.date?.year) events.push({ year: child.birth.date.year, label: `Naissance de ${child.name.display}`, detail: child.birth.place || '', iconKey: 'Users' });
    }
  }
  if (person.death?.date?.year) events.push({ year: person.death.date.year, label: 'Décès', detail: person.death.place || '', iconKey: 'Cross' });
  events.sort((a, b) => a.year - b.year);
  if (events.length === 0) return null;
  const birthYear = person.birth?.date?.year;
  return (
    <section className="px-4 sm:px-6 py-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon.Calendar className="size-4 text-[var(--ink-faint)]" />
        <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--ink-faint)]">Frise personnelle</h3>
      </div>
      <div className="relative pl-6">
        <div className="absolute left-2 top-1 bottom-1 w-px bg-[var(--border)]" />
        <div className="space-y-3">
          {events.map((e, i) => {
            const I = Icon[e.iconKey] ?? Icon.Calendar;
            const age = birthYear ? e.year - birthYear : null;
            return (
              <div key={i} className="relative flex items-start gap-3">
                <div className="absolute -left-6 top-1 size-2 rounded-full bg-[var(--accent)] ring-2 ring-[var(--bg)]" />
                <div className="text-xs font-mono tabular-nums text-[var(--ink-faint)] w-12 pt-0.5">{e.year}</div>
                <I className="size-3.5 text-[var(--ink-faint)] mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[var(--ink)]">
                    {e.label}
                    {age != null && age >= 0 && <span className="text-[var(--ink-faint)] font-mono"> · {age} ans</span>}
                  </div>
                  {e.detail && <div className="text-xs text-[var(--ink-muted)] truncate">{e.detail}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Main ProfileView ──────────────────────────────────────────────────────────

interface Props {
  person: Individual | null;
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  onSelect?: (id: string) => void;
}

export default function ProfileView({ person, individuals, families, onSelect }: Props) {
  const [factCounts, setFactCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    setFactCounts({});
    // AttachmentStore not yet migrated — will be wired up later
  }, [person?.id]);

  if (!person) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8 text-[var(--ink-faint)]">
        <div className="size-12 rounded-full grid place-items-center bg-[var(--surface-hover)] mb-4">
          <Icon.User className="size-5" />
        </div>
        <div className="text-sm">Sélectionnez une personne dans la liste pour voir ses détails.</div>
      </div>
    );
  }

  const masked = shouldMask(person);

  // Resolve relationships
  const parents: Individual[] = [];
  const siblings: Individual[] = [];
  for (const fid of person.famc || []) {
    const fam = families.get(fid);
    if (!fam) continue;
    if (fam.husband && fam.husband !== person.id) { const p = individuals.get(fam.husband); if (p) parents.push(p); }
    if (fam.wife && fam.wife !== person.id) { const p = individuals.get(fam.wife); if (p) parents.push(p); }
    for (const cid of fam.children || []) {
      if (cid !== person.id) { const s = individuals.get(cid); if (s) siblings.push(s); }
    }
  }
  const spouses: Individual[] = [];
  const children: Individual[] = [];
  const marriages: { partner: Individual | null; date: GDate; place: string }[] = [];
  for (const fid of person.fams || []) {
    const fam = families.get(fid);
    if (!fam) continue;
    const partnerId = fam.husband === person.id ? fam.wife : fam.husband;
    const partner = partnerId ? (individuals.get(partnerId) ?? null) : null;
    if (partner) spouses.push(partner);
    if (fam.marriage && (fam.marriage.date.display || fam.marriage.place)) {
      marriages.push({ partner, date: fam.marriage.date, place: fam.marriage.place });
    }
    for (const cid of fam.children || []) { const c = individuals.get(cid); if (c) children.push(c); }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-5 border-b border-[var(--border)] shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1 flex items-center gap-2">
              <span>{sexLabel(person.sex)} · <span className="text-[var(--ink-faint)]">{person.id}</span></span>
              {masked && (
                <span className="privacy-indicator">
                  <Icon.Lock style={{ width: 10, height: 10 }} />
                  Masqué·e
                </span>
              )}
            </div>
            <h2 className={`text-[20px] leading-tight sm:text-2xl font-semibold text-[var(--ink)] tracking-tight break-words ${masked ? 'is-private' : ''}`}>
              {person.name.display}
            </h2>
            <div className={`text-[12px] sm:text-sm font-mono text-[var(--ink-muted)] mt-1 ${masked ? 'is-private' : ''}`}>
              {formatVital(person)}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto mobile-pb-safe">
        {/* Vitals */}
        <section className="px-4 sm:px-6 py-4 border-b border-[var(--border)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            {(person.birth?.date?.display || person.birth?.place) && (
              <Field icon={Icon.Calendar} label="Naissance" badge={<FactSourceBadge count={factCounts.birth} />}>
                <div>{person.birth!.date.display || '—'}</div>
                <RepublicanBadge date={person.birth!.date} />
                {person.birth!.place && (
                  <div className="text-xs text-[var(--ink-muted)] mt-0.5 flex items-center gap-1">
                    <Icon.MapPin className="size-3" /> {person.birth!.place}
                  </div>
                )}
              </Field>
            )}
            {(person.death?.date?.display || person.death?.place) && (
              <Field icon={Icon.Cross} label="Décès" badge={<FactSourceBadge count={factCounts.death} />}>
                <div>{person.death!.date.display || '—'}</div>
                <RepublicanBadge date={person.death!.date} />
                {person.death!.place && (
                  <div className="text-xs text-[var(--ink-muted)] mt-0.5 flex items-center gap-1">
                    <Icon.MapPin className="size-3" /> {person.death!.place}
                  </div>
                )}
              </Field>
            )}
            {person.occupation && (
              <Field icon={Icon.Briefcase} label="Profession" badge={<FactSourceBadge count={factCounts.occupation} />}>
                {person.occupation}
              </Field>
            )}
            {marriages.length > 0 && (
              <Field icon={Icon.Heart} label="Mariage" badge={<FactSourceBadge count={factCounts.marriage} />}>
                {marriages.map((m, i) => (
                  <div key={i}>
                    <div>
                      {m.date.display || '—'}
                      {m.partner && <span className="text-[var(--ink-muted)]"> · avec {m.partner.name.display}</span>}
                    </div>
                    <RepublicanBadge date={m.date} />
                    {m.place && <div className="text-xs text-[var(--ink-muted)]">{m.place}</div>}
                  </div>
                ))}
              </Field>
            )}
          </div>
          {person.note && (
            <div className="mt-3 text-sm text-[var(--ink-muted)] italic border-l-2 border-[var(--border)] pl-3">
              {person.note}
            </div>
          )}
        </section>

        {/* Relations */}
        <section className="px-4 sm:px-6 py-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 mb-3">
            <Icon.Users className="size-4 text-[var(--ink-faint)]" />
            <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--ink-faint)]">Relations</h3>
          </div>
          <RelationGroup label="Parents" people={parents} onSelect={onSelect} />
          <RelationGroup label="Conjoint·e·s" people={spouses} onSelect={onSelect} />
          <RelationGroup label="Enfants" people={children} onSelect={onSelect} />
          <RelationGroup label="Frères et sœurs" people={siblings} onSelect={onSelect} />
        </section>

        {/* Mini ancestor tree */}
        <section className="px-4 sm:px-6 py-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 mb-4">
            <Icon.GitBranch className="size-4 text-[var(--ink-faint)]" />
            <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--ink-faint)]">Arbre ascendant · 3 générations</h3>
          </div>
          <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-2">
            <AncestorTree person={person} individuals={individuals} families={families} onSelect={onSelect} />
          </div>
        </section>

        {/* Personal timeline */}
        <PersonalTimeline person={person} families={families} individuals={individuals} />
      </div>
    </div>
  );
}
