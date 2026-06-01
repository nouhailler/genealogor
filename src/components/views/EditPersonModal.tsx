import { useState } from 'react';
import type { Individual, GDate, GEvent } from '@/types/genealogy';
import { Icon } from '@/components/ui-kit';

const MONTH_ABBRS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTH_FR   = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTH_NAMES = ['—', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                     'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const INPUT = 'w-full h-9 px-3 rounded-md bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--ink-faint)]';
const LABEL = 'block text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1';
const SECTION_TITLE = 'text-[10.5px] font-mono uppercase tracking-wider text-[var(--accent)] mb-3';

interface EventFields { day: string; month: string; year: string; place: string; }

function buildGDate(d: string, m: string, y: string): GDate {
  const year  = parseInt(y)  || null;
  const month = parseInt(m)  || null;
  const day   = parseInt(d)  || null;
  let raw = '', display = '';
  if (day && month && year) {
    raw     = `${day} ${MONTH_ABBRS[month - 1]} ${year}`;
    display = `${day} ${MONTH_FR[month - 1]} ${year}`;
  } else if (month && year) {
    raw     = `${MONTH_ABBRS[month - 1]} ${year}`;
    display = `${MONTH_FR[month - 1]} ${year}`;
  } else if (year) {
    raw = display = String(year);
  }
  return { raw, year, month, day, display };
}

function toFields(ev: GEvent | null): EventFields {
  if (!ev) return { day: '', month: '', year: '', place: '' };
  return {
    day:   ev.date.day   ? String(ev.date.day)   : '',
    month: ev.date.month ? String(ev.date.month) : '',
    year:  ev.date.year  ? String(ev.date.year)  : '',
    place: ev.place || '',
  };
}

function fromFields(f: EventFields): GEvent | null {
  if (!f.day && !f.month && !f.year && !f.place.trim()) return null;
  return { date: buildGDate(f.day, f.month, f.year), place: f.place.trim() };
}

interface Props {
  person: Individual;
  onSave: (updated: Individual) => void;
  onClose: () => void;
}

export default function EditPersonModal({ person, onSave, onClose }: Props) {
  const [given,      setGiven]      = useState(person.name.given || '');
  const [surname,    setSurname]    = useState(person.name.surname || '');
  const [sex,        setSex]        = useState<'M' | 'F' | 'U'>(person.sex);
  const [birth,      setBirth]      = useState<EventFields>(toFields(person.birth));
  const [death,      setDeath]      = useState<EventFields>(toFields(person.death));
  const [occupation, setOccupation] = useState(person.occupation || '');
  const [note,       setNote]       = useState(person.note || '');
  const [saved,      setSaved]      = useState(false);

  function handleSave() {
    const g = given.trim();
    const s = surname.trim();
    const updated: Individual = {
      ...person,
      name: {
        given:   g,
        surname: s,
        suffix:  person.name.suffix,
        display: [g, s].filter(Boolean).join(' ') || person.name.display,
      },
      sex,
      birth:      fromFields(birth),
      death:      fromFields(death),
      occupation: occupation.trim(),
      note:       note.trim(),
    };
    onSave(updated);
    setSaved(true);
    setTimeout(onClose, 600);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[var(--surface)] rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-lg max-h-[92dvh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-[var(--ink)]">Modifier la fiche</h2>
            <p className="text-xs text-[var(--ink-faint)] mt-0.5 font-mono">{person.id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)]">
            <Icon.X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-6">

          {/* Identité */}
          <section>
            <p className={SECTION_TITLE}>Identité</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={LABEL}>Prénom(s)</label>
                <input className={INPUT} value={given} onChange={e => setGiven(e.target.value)} placeholder="Jean Pierre" />
              </div>
              <div>
                <label className={LABEL}>Nom de famille</label>
                <input className={INPUT} value={surname} onChange={e => setSurname(e.target.value)} placeholder="DUPONT" />
              </div>
            </div>
            <div>
              <label className={LABEL}>Sexe</label>
              <div className="flex gap-2">
                {(['M', 'F', 'U'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setSex(s)}
                    className={`h-9 px-4 rounded-md text-sm border transition-colors ${
                      sex === s
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-white font-medium'
                        : 'border-[var(--border)] text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {s === 'M' ? 'Homme' : s === 'F' ? 'Femme' : 'Inconnu'}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Naissance */}
          <section>
            <p className={SECTION_TITLE}>Naissance</p>
            <EventSection value={birth} onChange={setBirth} />
          </section>

          {/* Décès */}
          <section>
            <p className={SECTION_TITLE}>Décès</p>
            <EventSection value={death} onChange={setDeath} />
          </section>

          {/* Profession */}
          <section>
            <label className={LABEL}>Profession</label>
            <input className={INPUT} value={occupation} onChange={e => setOccupation(e.target.value)} placeholder="ex : Agriculteur, Notaire…" />
          </section>

          {/* Note */}
          <section>
            <label className={LABEL}>Note</label>
            <textarea
              className={`${INPUT} h-auto py-2 resize-none`}
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Sources, observations…"
            />
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)] shrink-0">
          <button type="button" onClick={onClose}
            className="h-9 px-4 rounded-md text-sm text-[var(--ink-muted)] border border-[var(--border)] hover:border-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors">
            Annuler
          </button>
          <button type="button" onClick={handleSave}
            className="h-9 px-5 rounded-md text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity flex items-center gap-2">
            {saved ? <Icon.Check className="size-4" /> : <Icon.Pencil className="size-4" />}
            {saved ? 'Enregistré !' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EventSection({ value, onChange }: { value: EventFields; onChange: (v: EventFields) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={LABEL}>Jour</label>
          <input className={INPUT} type="number" min="1" max="31"
            value={value.day} onChange={e => onChange({ ...value, day: e.target.value })}
            placeholder="—" />
        </div>
        <div>
          <label className={LABEL}>Mois</label>
          <select className={INPUT} value={value.month} onChange={e => onChange({ ...value, month: e.target.value })}>
            {MONTH_NAMES.map((m, i) => (
              <option key={i} value={i === 0 ? '' : String(i)}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>Année</label>
          <input className={INPUT} type="number"
            value={value.year} onChange={e => onChange({ ...value, year: e.target.value })}
            placeholder="—" />
        </div>
      </div>
      <div>
        <label className={LABEL}>Lieu</label>
        <input className={INPUT} value={value.place} onChange={e => onChange({ ...value, place: e.target.value })}
          placeholder="ex : Paris, France" />
      </div>
    </div>
  );
}
