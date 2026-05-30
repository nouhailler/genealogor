// Global media gallery — shows all attachments, or filtered by personId.
import { useState, useCallback, useEffect, useRef } from 'react';
import { Icon } from '@/components/ui-kit';
import { listForPerson, listAll, addAttachment, resolveSrc } from '@/lib/attachment-store';
import type { Attachment } from '@/lib/attachment-store';
import AttachmentDetail from '@/components/media/AttachmentDetail';

interface Props {
  personId?: string;
  personName?: string;
}

export default function MediaGallery({ personId, personName }: Props) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = personId ? await listForPerson(personId) : await listAll();
    setItems(list.sort((a, b) => b.addedAt - a.addedAt));
    setLoading(false);
  }, [personId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const f of Array.from(files)) {
      await addAttachment({
        personId: personId || '',
        kind: 'photo',
        file: f,
      });
    }
    await refresh();
  };

  const subtitle = personName ? `· ${personName}` : '· bibliothèque';

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-[var(--border)] shrink-0">
        <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1">Médias</div>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[17px] sm:text-xl font-semibold text-[var(--ink)] tracking-tight">
            Galerie {subtitle}
            <span className="text-[var(--ink-faint)] font-normal font-mono text-xs ml-2">({items.length})</span>
          </h2>
          <button onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--ink-muted)] shrink-0">
            <Icon.Plus className="size-3.5" /> Ajouter
          </button>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden"
            onChange={(e) => { void handleFiles(e.target.files); e.target.value = ''; }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-md border border-[var(--border)] bg-[var(--surface)] aspect-square" style={{ background: 'var(--surface-hover)' }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-6">
            <div className="size-16 rounded-full grid place-items-center bg-[var(--surface)]">
              <Icon.FileText className="size-7 text-[var(--ink-faint)]" />
            </div>
            <div>
              <div className="text-sm font-medium text-[var(--ink)]">Aucun média</div>
              <div className="text-xs text-[var(--ink-faint)] mt-1">
                Ajoutez photos, actes ou documents — stockés localement sur cet appareil (IndexedDB).
              </div>
            </div>
            <button onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] text-[var(--ink-muted)] hover:text-[var(--accent)] transition-colors">
              <Icon.Upload className="size-4" /> Ajouter des fichiers
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((m) => (
              <MediaThumb key={m.id} item={m} onClick={() => setSelectedId(m.id ?? null)} />
            ))}
          </div>
        )}
      </div>

      {selectedId != null && (
        <AttachmentDetail
          attachmentId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdate={() => void refresh()}
        />
      )}
    </div>
  );
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────

function MediaThumb({ item, onClick }: { item: Attachment; onClick: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let blobUrl: string | null = null;
    resolveSrc(item).then((u) => {
      if (u?.startsWith('blob:')) blobUrl = u;
      setUrl(u);
    });
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [item]);

  const isImage = item.mimeType?.startsWith('image/');

  return (
    <div className="group relative rounded-md border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[var(--accent)] hover:shadow-md transition-all cursor-pointer" onClick={onClick}>
      <div className="aspect-square bg-[var(--bg)] grid place-items-center overflow-hidden">
        {isImage && url ? (
          <img src={url} alt={item.filename} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center text-[var(--ink-faint)] gap-1">
            <Icon.FileText className="size-6" />
            <span className="text-[10px] font-mono">{item.mimeType?.split('/')[1]?.toUpperCase() || 'FILE'}</span>
          </div>
        )}
      </div>
      <div className="px-2 py-1.5">
        <div className="text-[11px] truncate text-[var(--ink-muted)]">{item.filename}</div>
        <div className="text-[10px] font-mono text-[var(--ink-faint)]">
          {new Date(item.addedAt).toLocaleDateString('fr-FR')}
        </div>
      </div>
    </div>
  );
}
