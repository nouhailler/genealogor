// Google Photos shared-album section for ProfileView.
// The album share URL is stored on the Individual (GEDCOM tag _GPHOTOS) and
// thumbnails are extracted client-side via src/lib/gphotos.ts.
import { useState, useEffect } from 'react';
import type { Individual } from '@/types/genealogy';
import { Icon } from '@/components/ui-kit';
import { fetchAlbumImages, invalidateAlbumCache, gphotoUrl, isGPhotosAlbumUrl } from '@/lib/gphotos';

interface Props {
  person: Individual;
  masked: boolean;
  onEditPerson?: (updated: Individual) => void;
}

export default function GooglePhotosSection({ person, masked, onEditPerson }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const album = person.gphotosAlbum ?? '';

  useEffect(() => {
    setUrls([]); setError(null); setEditing(false); setDraft(album);
    if (!album) return;
    let cancelled = false;
    setLoading(true);
    fetchAlbumImages(album)
      .then((u) => { if (!cancelled) setUrls(u); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [album, person.id]);

  const save = () => {
    const url = draft.trim();
    if (url && !isGPhotosAlbumUrl(url)) {
      setError('Collez un lien de partage Google Photos (photos.app.goo.gl/… ou photos.google.com/share/…).');
      return;
    }
    setError(null);
    setEditing(false);
    // Clearing the album also clears a portrait that came from it.
    const portraitFromAlbum = person.portraitUrl && urls.includes(person.portraitUrl);
    onEditPerson?.({
      ...person,
      gphotosAlbum: url || undefined,
      portraitUrl: !url && portraitFromAlbum ? undefined : person.portraitUrl,
    });
  };

  const refresh = () => {
    if (!album) return;
    invalidateAlbumCache(album);
    setLoading(true); setError(null);
    fetchAlbumImages(album, { force: true })
      .then(setUrls)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  const togglePortrait = (base: string) => {
    onEditPerson?.({ ...person, portraitUrl: person.portraitUrl === base ? undefined : base });
  };

  const iconBtn = 'h-7 px-1.5 inline-flex items-center gap-1 rounded text-[11px] font-mono text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition-colors';

  return (
    <section className="px-4 sm:px-6 py-5 border-b border-[var(--border)]">
      <div className="flex items-center gap-2 mb-3">
        <Icon.Paperclip className="size-4 text-[var(--ink-faint)]" />
        <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--ink-faint)]">Google Photos</h3>
        <div className="ml-auto flex items-center gap-1">
          {album && (
            <>
              <a href={album} target="_blank" rel="noopener noreferrer" className={iconBtn} title="Ouvrir l'album dans Google Photos">
                <Icon.Share className="size-3.5" /> Album ↗
              </a>
              <button onClick={refresh} className={iconBtn} title="Rafraîchir les miniatures">
                <Icon.RotateCcw className="size-3.5" />
              </button>
            </>
          )}
          {onEditPerson && (
            <button onClick={() => { setEditing((v) => !v); setDraft(album); setError(null); }} className={iconBtn}
              title={album ? 'Modifier le lien de l\'album' : 'Lier un album Google Photos'}>
              {album ? <Icon.Pencil className="size-3.5" /> : <><Icon.Plus className="size-3.5" /> Lier un album</>}
            </button>
          )}
        </div>
      </div>

      {/* Link editor */}
      {editing && (
        <div className="mb-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            placeholder="https://photos.app.goo.gl/…"
            className="w-full h-11 sm:h-9 px-3 rounded-md bg-[var(--bg)] border border-[var(--border)] text-sm font-mono text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)]"
            autoFocus
          />
          <div className="text-[10.5px] font-mono text-[var(--ink-faint)] leading-relaxed">
            Dans Google Photos : ouvrez l'album → Partager → <strong className="text-[var(--ink-muted)]">Créer un lien</strong>, puis collez-le ici.
            Le lien est enregistré dans vos données (tag GEDCOM <code>_GPHOTOS</code>).
          </div>
          <div className="flex items-center gap-2">
            <button onClick={save}
              className="text-xs font-medium px-3 py-1.5 rounded bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90">
              Enregistrer
            </button>
            {album && (
              <button onClick={() => { setDraft(''); }}
                className="text-xs px-3 py-1.5 rounded border border-[var(--border)] text-[var(--ink-muted)] hover:text-[var(--danger)]"
                title="Vider le champ puis Enregistrer pour retirer le lien">
                Vider
              </button>
            )}
            <button onClick={() => { setEditing(false); setError(null); }}
              className="text-xs px-3 py-1.5 rounded border border-[var(--border)] text-[var(--ink-muted)] hover:text-[var(--ink)]">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!album && !editing && (
        <p className="text-sm text-[var(--ink-muted)]">
          Aucun album lié. {onEditPerson ? 'Cliquez « Lier un album » pour associer un album Google Photos partagé par lien à cette personne.' : ''}
        </p>
      )}

      {error && (
        <div className="mb-3 rounded-md border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
          {error}
        </div>
      )}

      {/* Thumbnails */}
      {album && loading && (
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="size-20 rounded-md bg-[var(--surface-hover)] animate-pulse" />
          ))}
        </div>
      )}
      {album && !loading && urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((u) => {
            const isPortrait = person.portraitUrl === u;
            return (
              <div key={u} className="relative group">
                <a href={gphotoUrl(u, 2048)} target="_blank" rel="noopener noreferrer" title="Afficher la photo (hébergée par Google)">
                  <img
                    src={gphotoUrl(u, 160)}
                    alt=""
                    loading="lazy"
                    className={`size-20 rounded-md object-cover border transition-transform group-hover:scale-[1.03] ${masked ? 'is-private' : ''}`}
                    style={{ borderColor: isPortrait ? 'var(--warn)' : 'var(--border)', borderWidth: isPortrait ? 2 : 1 }}
                  />
                </a>
                {onEditPerson && (
                  <button
                    onClick={() => togglePortrait(u)}
                    className={`absolute top-1 right-1 size-6 grid place-items-center rounded-full transition-opacity ${isPortrait ? '' : 'opacity-0 group-hover:opacity-100'}`}
                    style={{ background: 'rgba(12,12,20,0.65)', color: isPortrait ? 'var(--warn)' : '#fff' }}
                    title={isPortrait ? 'Retirer le portrait' : 'Définir comme portrait du profil'}
                  >
                    <Icon.Star className="size-3.5" style={{ fill: isPortrait ? 'var(--warn)' : 'none' }} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
