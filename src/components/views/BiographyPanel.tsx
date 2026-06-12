// AI biography section — 4-6 sentence factual bio, cached per person in localStorage.
import { useState, useEffect } from 'react';
import { Icon } from '@/components/ui-kit';
import { aiCall } from '@/lib/ai-client';
import type { Individual, Family } from '@/types/genealogy';

const BIO_CACHE_KEY = 'genealogor.bios';

function loadCache(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(BIO_CACHE_KEY) || '{}') as Record<string, string>; }
  catch { return {}; }
}
function saveCache(c: Record<string, string>): void {
  try { localStorage.setItem(BIO_CACHE_KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

function buildPrompt(
  person: Individual,
  parents: Individual[],
  marriages: Array<{ date?: string; place?: string; partner: Individual | null }>,
  children: Individual[],
): string {
  const facts: string[] = [];
  facts.push(`Nom: ${person.name.display}`);
  if (person.sex) facts.push(`Sexe: ${person.sex === 'M' ? 'Homme' : person.sex === 'F' ? 'Femme' : '—'}`);
  if (person.birth?.date?.display) facts.push(`Naissance: ${person.birth.date.display}${person.birth.place ? ' à ' + person.birth.place : ''}`);
  if (person.death?.date?.display) facts.push(`Décès: ${person.death.date.display}${person.death.place ? ' à ' + person.death.place : ''}`);
  if (person.occupation) facts.push(`Profession: ${person.occupation}`);
  if (parents.length) facts.push(`Parents: ${parents.map((p) => p.name.display).join(', ')}`);
  if (marriages.length) {
    facts.push('Mariages:');
    for (const m of marriages) {
      facts.push(`  - ${m.partner?.name.display ?? '?'}${m.date ? ' (' + m.date + ')' : ''}${m.place ? ' à ' + m.place : ''}`);
    }
  }
  if (children.length) {
    facts.push(`Enfants (${children.length}): ${children.slice(0, 8).map((c) => c.name.display).join(', ')}${children.length > 8 ? '…' : ''}`);
  }
  if (person.note) facts.push(`Note: ${person.note}`);

  return [
    'Tu es un généalogiste rédigeant une notice biographique courte et factuelle en français.',
    'À partir des faits ci-dessous, écris UNE biographie de 4 à 6 phrases, ton sobre et historique, sans inventer de faits non listés.',
    'Si une donnée manque, ne la mentionne pas. Pas de spéculation. Pas de listes. Un seul paragraphe.',
    '',
    'FAITS:',
    facts.join('\n'),
    '',
    'BIOGRAPHIE:',
  ].join('\n');
}

interface Props {
  person: Individual;
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
}

export default function BiographyPanel({ person, individuals, families }: Props) {
  const [bio, setBio]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [cached, setCached]   = useState(false);

  useEffect(() => {
    setBio('');
    setError('');
    const c = loadCache();
    if (c[person.id]) {
      setBio(c[person.id]);
      setCached(true);
    } else {
      setCached(false);
    }
  }, [person.id]);

  // Resolve relationships
  const parents: Individual[] = [];
  for (const fid of person.famc || []) {
    const fam = families.get(fid);
    if (!fam) continue;
    if (fam.husband) { const p = individuals.get(fam.husband); if (p) parents.push(p); }
    if (fam.wife)    { const p = individuals.get(fam.wife);    if (p) parents.push(p); }
  }

  const marriages: Array<{ date?: string; place?: string; partner: Individual | null }> = [];
  const children: Individual[] = [];
  for (const fid of person.fams || []) {
    const fam = families.get(fid);
    if (!fam) continue;
    const partnerId = fam.husband === person.id ? fam.wife : fam.husband;
    const partner   = partnerId ? (individuals.get(partnerId) ?? null) : null;
    marriages.push({ date: fam.marriage?.date?.display, place: fam.marriage?.place, partner });
    for (const cid of fam.children || []) {
      const c = individuals.get(cid); if (c) children.push(c);
    }
  }

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const prompt = buildPrompt(person, parents, marriages, children);
      const text   = await aiCall(prompt);
      const clean  = (text || '').trim();
      setBio(clean);
      setCached(true);
      const c = loadCache();
      c[person.id] = clean;
      saveCache(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la génération');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="px-4 sm:px-6 py-5 border-b border-[var(--border)]">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Icon.Sparkles className="size-4 text-[var(--accent)]" />
          <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--ink-faint)]">Biographie</h3>
          {cached && (
            <span className="text-[10px] font-mono text-[var(--ink-faint)] px-1.5 py-0.5 rounded bg-[var(--surface-hover)]">
              cache
            </span>
          )}
        </div>
        {bio && (
          <button
            onClick={() => void generate()}
            disabled={loading}
            className="text-xs font-mono text-[var(--ink-muted)] hover:text-[var(--ink)] disabled:opacity-50 px-2 py-1 rounded hover:bg-[var(--surface-hover)] transition-colors"
          >
            {loading ? '…' : 'Régénérer'}
          </button>
        )}
      </div>

      {!bio && !loading && (
        <button
          onClick={() => void generate()}
          className="w-full border border-dashed border-[var(--border)] rounded-md px-4 py-6 text-sm text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[color:var(--accent)]/5 transition-colors flex items-center justify-center gap-2"
        >
          <Icon.Sparkles className="size-4" />
          Générer une biographie
        </button>
      )}

      {loading && (
        <div className="text-sm text-[var(--ink-muted)] flex items-center gap-2 px-1 py-3">
          <span className="inline-block size-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="inline-block size-1.5 rounded-full bg-[var(--accent)] animate-pulse [animation-delay:150ms]" />
          <span className="inline-block size-1.5 rounded-full bg-[var(--accent)] animate-pulse [animation-delay:300ms]" />
          <span className="ml-2">Rédaction en cours…</span>
        </div>
      )}

      {bio && !loading && (
        <div className="text-sm text-[var(--ink)] leading-relaxed whitespace-pre-wrap">{bio}</div>
      )}

      {error && (
        <div className="text-xs text-[var(--danger)] mt-2 font-mono">{error}</div>
      )}

      <div className="text-[10px] font-mono text-[var(--ink-faint)] mt-3 italic">
        Synthèse IA basée sur les données du fichier. À vérifier avant publication.
      </div>
    </section>
  );
}
