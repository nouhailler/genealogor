// Fullscreen presentation — 5 slides, keyboard nav (←/→/Space/Esc).
import { useState, useEffect } from 'react';
import { formatVital, Icon } from '@/components/ui-kit';
import type { Individual, Family } from '@/types/genealogy';

interface Props {
  person: Individual;
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  onClose: () => void;
  onChangePerson: (id: string) => void;
}

const SLIDES = ['title', 'vitals', 'parents', 'marriages', 'children'] as const;
type Slide = typeof SLIDES[number];

export default function PresentationMode({ person, individuals, families, onClose, onChangePerson }: Props) {
  const [idx, setIdx] = useState(0);
  const current: Slide = SLIDES[idx];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); setIdx((i) => Math.min(SLIDES.length - 1, i + 1)); }
      if (e.key === 'ArrowLeft')                    { setIdx((i) => Math.max(0, i - 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Resolve relationships
  const parents: Individual[] = [];
  for (const fid of person.famc || []) {
    const fam = families.get(fid);
    if (!fam) continue;
    if (fam.husband) { const p = individuals.get(fam.husband); if (p) parents.push(p); }
    if (fam.wife)    { const p = individuals.get(fam.wife);    if (p) parents.push(p); }
  }

  const marriages: Array<{ partner: Individual | null; date?: string; place?: string }> = [];
  const children: Individual[] = [];
  for (const fid of person.fams || []) {
    const fam = families.get(fid);
    if (!fam) continue;
    const partnerId = fam.husband === person.id ? fam.wife : fam.husband;
    const partner = partnerId ? (individuals.get(partnerId) ?? null) : null;
    marriages.push({ partner, date: fam.marriage?.date?.display, place: fam.marriage?.place });
    for (const cid of fam.children || []) { const c = individuals.get(cid); if (c) children.push(c); }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--bg)] flex flex-col">
      {/* Top bar */}
      <div className="absolute top-0 right-0 p-4 flex items-center gap-2 z-10">
        <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mr-2">
          {idx + 1}/{SLIDES.length}
        </div>
        <button onClick={onClose} className="size-9 grid place-items-center rounded-md text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]" title="Quitter (Échap)">
          <Icon.X className="size-5" />
        </button>
      </div>

      {/* Slide content */}
      <div className="flex-1 grid place-items-center p-12">
        <div className="max-w-3xl w-full text-center">

          {current === 'title' && (
            <div className="space-y-4">
              <div className="text-[11px] font-mono uppercase tracking-[0.3em] text-[var(--ink-faint)]">Fiche généalogique</div>
              <h1 className="text-6xl sm:text-7xl font-semibold tracking-tight text-[var(--ink)] leading-[1.05]">
                {person.name.given}<br/>
                <span className="uppercase">{person.name.surname}</span>
              </h1>
              <div className="text-2xl font-mono text-[var(--ink-muted)]">{formatVital(person)}</div>
              {person.occupation && <div className="text-xl italic text-[var(--ink-muted)]">{person.occupation}</div>}
            </div>
          )}

          {current === 'vitals' && (
            <div className="space-y-8 text-left max-w-xl mx-auto">
              <div className="text-[11px] font-mono uppercase tracking-[0.3em] text-[var(--ink-faint)] text-center">Naissance & décès</div>
              {person.birth && (
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1">Né{person.sex === 'F' ? 'e' : ''}</div>
                  <div className="text-3xl text-[var(--ink)]">{person.birth.date?.display || '—'}</div>
                  {person.birth.place && <div className="text-xl text-[var(--ink-muted)] mt-1">à {person.birth.place}</div>}
                </div>
              )}
              {person.death && (
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1">Décédé{person.sex === 'F' ? 'e' : ''}</div>
                  <div className="text-3xl text-[var(--ink)]">{person.death.date?.display || '—'}</div>
                  {person.death.place && <div className="text-xl text-[var(--ink-muted)] mt-1">à {person.death.place}</div>}
                </div>
              )}
            </div>
          )}

          {current === 'parents' && (
            <div className="space-y-6">
              <div className="text-[11px] font-mono uppercase tracking-[0.3em] text-[var(--ink-faint)]">Parents</div>
              {parents.length === 0 ? (
                <div className="text-2xl text-[var(--ink-faint)] italic">Inconnus</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {parents.map((p) => (
                    <button key={p.id} onClick={() => onChangePerson(p.id)}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 hover:border-[var(--accent)]">
                      <div className="text-2xl font-medium text-[var(--ink)]">{p.name.display}</div>
                      <div className="text-base font-mono text-[var(--ink-muted)] mt-1">{formatVital(p)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {current === 'marriages' && (
            <div className="space-y-6">
              <div className="text-[11px] font-mono uppercase tracking-[0.3em] text-[var(--ink-faint)]">Mariages</div>
              {marriages.length === 0 ? (
                <div className="text-2xl text-[var(--ink-faint)] italic">Aucun mariage enregistré</div>
              ) : (
                <div className="space-y-4">
                  {marriages.map((m, i) => (
                    <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
                      <div className="text-2xl text-[var(--ink)]">
                        avec{' '}
                        {m.partner ? (
                          <button onClick={() => onChangePerson(m.partner!.id)} className="font-medium hover:text-[var(--accent)]">
                            {m.partner.name.display}
                          </button>
                        ) : '?'}
                      </div>
                      <div className="text-base font-mono text-[var(--ink-muted)] mt-2">
                        {m.date || '—'}{m.place ? ` · ${m.place}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {current === 'children' && (
            <div className="space-y-6">
              <div className="text-[11px] font-mono uppercase tracking-[0.3em] text-[var(--ink-faint)]">
                Enfants{children.length > 0 ? ` · ${children.length}` : ''}
              </div>
              {children.length === 0 ? (
                <div className="text-2xl text-[var(--ink-faint)] italic">Aucun</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {children.map((c) => (
                    <button key={c.id} onClick={() => onChangePerson(c.id)}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--accent)] text-left">
                      <div className="text-base font-medium text-[var(--ink)] truncate">{c.name.display}</div>
                      <div className="text-xs font-mono text-[var(--ink-muted)] mt-0.5">{formatVital(c)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Footer nav */}
      <div className="px-6 py-4 flex items-center justify-between border-t border-[var(--border)]">
        <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
          className="px-3 py-1.5 rounded text-sm text-[var(--ink-muted)] disabled:opacity-30 hover:bg-[var(--surface-hover)]">
          ← Précédent
        </button>
        <div className="flex gap-1">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`size-2 rounded-full ${i === idx ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
          ))}
        </div>
        <button onClick={() => setIdx((i) => Math.min(SLIDES.length - 1, i + 1))} disabled={idx === SLIDES.length - 1}
          className="px-3 py-1.5 rounded text-sm text-[var(--ink-muted)] disabled:opacity-30 hover:bg-[var(--surface-hover)]">
          Suivant →
        </button>
      </div>
    </div>
  );
}
