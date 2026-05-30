// A4 printable identity card for a person.
// Opened as a modal overlay; "Imprimer" calls window.print().
import { formatVital } from '@/components/ui-kit';
import type { Individual, Family, GEvent } from '@/types/genealogy';

interface Props {
  person: Individual;
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  onClose: () => void;
}

export default function BusinessCard({ person, individuals, families, onClose }: Props) {
  const parents: Individual[] = [];
  for (const fid of person.famc || []) {
    const fam = families.get(fid);
    if (!fam) continue;
    if (fam.husband) { const p = individuals.get(fam.husband); if (p) parents.push(p); }
    if (fam.wife)    { const p = individuals.get(fam.wife);    if (p) parents.push(p); }
  }

  const marriages: Array<{ date?: GEvent['date']; place?: string; partner: Individual | null }> = [];
  const children: Individual[] = [];
  for (const fid of person.fams || []) {
    const fam = families.get(fid);
    if (!fam) continue;
    const partnerId = fam.husband === person.id ? fam.wife : fam.husband;
    const partner = partnerId ? (individuals.get(partnerId) ?? null) : null;
    marriages.push({ date: fam.marriage?.date, place: fam.marriage?.place, partner });
    for (const cid of fam.children || []) {
      const c = individuals.get(cid); if (c) children.push(c);
    }
  }

  const doPrint = () => {
    document.body.classList.add('print-card-mode');
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove('print-card-mode'), 500);
    }, 100);
  };

  const today = new Date().toLocaleDateString('fr-FR');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-auto print:bg-white print:p-0" onClick={onClose}>
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-[var(--bg)] border-b border-[var(--border)] px-4 py-3 flex items-center justify-between gap-3 print:hidden">
        <div className="text-xs font-mono text-[var(--ink-muted)]">Fiche d'identité · prêt à imprimer (A4)</div>
        <div className="flex gap-2">
          <button onClick={doPrint} className="text-xs font-mono px-3 py-1.5 rounded bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90">
            Imprimer
          </button>
          <button onClick={onClose} className="text-xs font-mono px-3 py-1.5 rounded border border-[var(--border)] hover:bg-[var(--surface-hover)]">
            Fermer
          </button>
        </div>
      </div>

      {/* A4 card */}
      <div
        className="relative my-6 mx-auto bg-white text-black shadow-2xl print:shadow-none print:my-0"
        style={{ width: '210mm', minHeight: '297mm', padding: '20mm' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ borderBottom: '3px solid #1a1a1a', paddingBottom: '8mm', marginBottom: '10mm' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '9pt', letterSpacing: '0.15em', color: '#666', textTransform: 'uppercase', marginBottom: '2mm' }}>
            Fiche généalogique · {person.id}
          </div>
          <div style={{ fontSize: '32pt', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
            {person.name.given} <span style={{ textTransform: 'uppercase' }}>{person.name.surname}</span>
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11pt', marginTop: '3mm', color: '#444', display: 'flex', alignItems: 'baseline', gap: '8mm' }}>
            <span>{formatVital(person)}</span>
            {person.occupation && <span style={{ fontStyle: 'italic' }}>{person.occupation}</span>}
          </div>
        </div>

        <CardField label="Naissance" event={person.birth} />
        <CardField label="Décès"     event={person.death} />

        {parents.length > 0 && (
          <CardSection label="Parents">
            {parents.map((p, i) => <CardPerson key={i} person={p} />)}
          </CardSection>
        )}

        {marriages.length > 0 && (
          <CardSection label="Mariages">
            {marriages.map((m, i) => (
              <div key={i} style={{ marginBottom: '3mm' }}>
                <div style={{ fontSize: '11pt' }}>
                  <strong>{m.partner?.name?.display || '—'}</strong>
                  {m.date?.display && <span style={{ color: '#666' }}> · {m.date.display}</span>}
                </div>
                {m.place && <div style={{ fontSize: '9pt', color: '#666', fontFamily: 'JetBrains Mono, monospace' }}>{m.place}</div>}
              </div>
            ))}
          </CardSection>
        )}

        {children.length > 0 && (
          <CardSection label={`Enfants (${children.length})`}>
            {children.map((c) => <CardPerson key={c.id} person={c} />)}
          </CardSection>
        )}

        {person.note && (
          <CardSection label="Note">
            <div style={{ fontSize: '10pt', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{person.note}</div>
          </CardSection>
        )}

        {/* Footer */}
        <div style={{ position: 'absolute', bottom: '12mm', left: '20mm', right: '20mm', fontFamily: 'JetBrains Mono, monospace', fontSize: '7pt', color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase', borderTop: '1px solid #ddd', paddingTop: '3mm', display: 'flex', justifyContent: 'space-between' }}>
          <span>Genealogor · fiche éditée le {today}</span>
          <span>Donnée vérifiable depuis le fichier GEDCOM source</span>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CardField({ label, event }: { label: string; event: Individual['birth'] }) {
  if (!event || (!event.date?.display && !event.place)) return null;
  return (
    <div style={{ marginBottom: '5mm', display: 'flex', gap: '8mm', alignItems: 'baseline' }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#999', width: '30mm', flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: '11pt' }}>
        {event.date?.display}
        {event.place && <span style={{ marginLeft: '4mm', color: '#666' }}>· {event.place}</span>}
      </div>
    </div>
  );
}

function CardSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: '8mm', marginBottom: '5mm' }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#999', marginBottom: '3mm', borderBottom: '1px solid #ddd', paddingBottom: '1mm' }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function CardPerson({ person }: { person: Individual }) {
  return (
    <div style={{ fontSize: '10pt', marginBottom: '1mm' }}>
      {person.name.display}
      <span style={{ marginLeft: '3mm', fontFamily: 'JetBrains Mono, monospace', fontSize: '8pt', color: '#888' }}>{formatVital(person)}</span>
    </div>
  );
}
