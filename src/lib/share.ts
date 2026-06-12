// Web Share API helper — share a person card, falling back to clipboard copy.
import { getCachedShortBio } from '@/lib/ai-features';
import type { Individual } from '@/types/genealogy';

export type ShareResult = 'shared' | 'copied' | 'failed';

export async function sharePerson(person: Individual): Promise<ShareResult> {
  if (!person) return 'failed';
  const vitals: string[] = [];
  if (person.birth?.date?.year || person.birth?.place) {
    vitals.push(`Naissance : ${person.birth?.date?.display || person.birth?.date?.year || '?'}${person.birth?.place ? ' à ' + person.birth.place : ''}`);
  }
  if (person.death?.date?.year || person.death?.place) {
    vitals.push(`Décès : ${person.death?.date?.display || person.death?.date?.year || '?'}${person.death?.place ? ' à ' + person.death.place : ''}`);
  }
  if (person.occupation) vitals.push(`Profession : ${person.occupation}`);

  const bio = getCachedShortBio(person.id);
  const url = `${location.origin}${location.pathname}?person=${encodeURIComponent(person.id)}`;
  const text = [person.name?.display, bio ? `\n${bio}` : '', vitals.length ? '\n\n' + vitals.join('\n') : ''].filter(Boolean).join('');

  try {
    if (navigator.share) {
      await navigator.share({ title: `Genealogor — ${person.name?.display}`, text, url });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return 'failed';
  }
  try {
    await navigator.clipboard.writeText(`${text}\n\n${url}`);
    return 'copied';
  } catch { return 'failed'; }
}

export function canShare(): boolean {
  return !!(navigator.share || navigator.clipboard);
}
