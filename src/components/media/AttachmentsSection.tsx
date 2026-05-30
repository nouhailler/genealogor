// Photos & Actes section rendered inside the profile view.
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Icon } from '@/components/ui-kit';
import {
  addAttachment, listForPerson, resolveSrc,
} from '@/lib/attachment-store';
import type { Attachment, AttachmentKind } from '@/lib/attachment-store';
import AttachmentDetail from './AttachmentDetail';

interface Props {
  personId: string;
  personName: string;
  kind: AttachmentKind;
  refreshSignal?: number;
  onChanged?: () => void;
}

export default function AttachmentsSection({ personId, kind, refreshSignal, onChanged }: Props) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [adding, setAdding] = useState<'file' | 'url' | null>(null);
  const [urlDraft, setUrlDraft] = useState('');
  const [acteTypeDraft, setActeTypeDraft] = useState<string>('birth');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await listForPerson(personId, kind);
    setItems(list.sort((a, b) => b.addedAt - a.addedAt));
    setLoading(false);
  }, [personId, kind]);

  useEffect(() => { void refresh(); }, [refresh, refreshSignal]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const f of Array.from(files)) {
      await addAttachment({
        personId, kind, file: f,
        acteType: kind === 'acte' ? (acteTypeDraft as 'birth' | 'death' | 'marriage' | 'other') : undefined,
      });
    }
    setAdding(null);
    setShowAddMenu(false);
    await refresh();
    onChanged?.();
  };

  const addCloud = async () => {
    if (!urlDraft.trim()) return;
    await addAttachment({
      personId, kind, cloudUrl: urlDraft.trim(),
      acteType: kind === 'acte' ? (acteTypeDraft as 'birth' | 'death' | 'marriage' | 'other') : undefined,
    });
    setUrlDraft('');
    setAdding(null);
    setShowAddMenu(false);
    await refresh();
    onChanged?.();
  };

  const filtered = kind === 'acte' && activeFilter !== 'all'
    ? items.filter((it) => (it.acteType || 'other') === activeFilter)
    : items;

  const acteCounts = useMemo(() => {
    if (kind !== 'acte') return null;
    const c: Record<string, number> = { all: items.length, birth: 0, death: 0, marriage: 0, other: 0 };
    for (const it of items) c[it.acteType || 'other'] = (c[it.acteType || 'other'] || 0) + 1;
    return c;
  }, [items, kind]);

  const title = kind === 'photo' ? 'Photos' : 'Actes';
  const IconEl = kind === 'photo' ? Icon.User : Icon.FileText;

  const ACTE_TYPES: Array<[string, string]> = [['birth', 'Naissance'], ['death', 'Décès'], ['marriage', 'Mariage'], ['other', 'Autre']];

  return (
    <section className="px-4 sm:px-6 py-5 border-b border-[var(--border)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <IconEl className="size-4 text-[var(--ink-faint)]" />
          <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--ink-faint)]">
            {title} ({items.length})
          </h3>
        </div>
        <div className="relative">
          <button onClick={() => setShowAddMenu((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--ink-muted)]">
            <Icon.Plus className="size-3" /> Ajouter
          </button>
          {showAddMenu && (
            <div className="absolute right-0 top-8 z-10 bg-[var(--bg)] border border-[var(--border)] rounded-md shadow-lg p-1 min-w-[200px]">
              <button onClick={() => { setAdding('file'); setShowAddMenu(false); fileRef.current?.click(); }}
                className="w-full text-left px-3 py-2 hover:bg-[var(--surface-hover)] rounded text-sm flex items-center gap-2">
                <Icon.Upload className="size-3.5 text-[var(--ink-faint)]" />
                <div>
                  <div className="text-[var(--ink)]">Fichier local</div>
                  <div className="text-[10px] font-mono text-[var(--ink-faint)]">Stocké sur cet appareil</div>
                </div>
              </button>
              <button onClick={() => { setAdding('url'); setShowAddMenu(false); }}
                className="w-full text-left px-3 py-2 hover:bg-[var(--surface-hover)] rounded text-sm flex items-center gap-2">
                <span className="size-3.5 grid place-items-center text-[var(--ink-faint)]">☁</span>
                <div>
                  <div className="text-[var(--ink)]">URL cloud</div>
                  <div className="text-[10px] font-mono text-[var(--ink-faint)]">Lien externe (Cloudinary, etc.)</div>
                </div>
              </button>
            </div>
          )}
          <input ref={fileRef} type="file"
            accept={kind === 'photo' ? 'image/*' : 'image/*,application/pdf'}
            multiple className="hidden"
            onChange={(e) => { void handleFiles(e.target.files); e.target.value = ''; }} />
        </div>
      </div>

      {/* Acte filter chips */}
      {kind === 'acte' && items.length > 0 && acteCounts && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {([['all', 'Tous'], ...ACTE_TYPES] as Array<[string, string]>).map(([k, l]) => (
            <button key={k} onClick={() => setActiveFilter(k)}
              className={`text-[11px] font-mono px-2 py-0.5 rounded ${activeFilter === k ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'border border-[var(--border)] text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]'}`}>
              {l} · {acteCounts[k] ?? 0}
            </button>
          ))}
        </div>
      )}

      {/* Acte type selector when adding */}
      {kind === 'acte' && adding && (
        <div className="mb-3 flex items-center gap-2 text-xs flex-wrap">
          <span className="text-[var(--ink-faint)] font-mono">Type d'acte :</span>
          {ACTE_TYPES.map(([k, l]) => (
            <button key={k} onClick={() => setActeTypeDraft(k)}
              className={`px-2 py-0.5 rounded ${acteTypeDraft === k ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'border border-[var(--border)] text-[var(--ink-muted)]'}`}>
              {l}
            </button>
          ))}
        </div>
      )}

      {/* URL input */}
      {adding === 'url' && (
        <div className="mb-3 flex gap-2">
          <input value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void addCloud(); }}
            placeholder="https://votre-cloud.com/document.jpg"
            autoFocus
            className="flex-1 h-9 px-2 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]" />
          <button onClick={() => void addCloud()} disabled={!urlDraft.trim()}
            className="text-xs font-medium px-3 rounded-md bg-[var(--accent)] text-[var(--accent-ink)] disabled:opacity-40">
            Lier
          </button>
          <button onClick={() => { setAdding(null); setUrlDraft(''); }} className="text-xs text-[var(--ink-muted)] px-2">Annuler</button>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-md border border-[var(--border)] bg-[var(--surface)] aspect-square" style={{ background: 'var(--surface-hover)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--border)] p-6 text-center text-xs text-[var(--ink-faint)]">
          {kind === 'photo'
            ? 'Aucune photo. Ajoutez des portraits, photos d\'archives, scènes de famille…'
            : 'Aucun acte. Ajoutez actes de naissance, de décès, registres paroissiaux…'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {filtered.map((it) => (
            <AttachmentThumb key={it.id} attachment={it} onClick={() => setSelectedId(it.id ?? null)} />
          ))}
        </div>
      )}

      {selectedId != null && (
        <AttachmentDetail
          attachmentId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdate={() => { void refresh(); onChanged?.(); }}
        />
      )}
    </section>
  );
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────

function AttachmentThumb({ attachment, onClick }: { attachment: Attachment; onClick: () => void }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let blobUrl: string | null = null;
    resolveSrc(attachment).then((url) => {
      if (url?.startsWith('blob:')) blobUrl = url;
      setSrc(url);
    });
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [attachment]);

  const isImage = attachment.mimeType?.startsWith('image/');
  const isPdf = attachment.mimeType === 'application/pdf';
  const acteLabel = attachment.kind === 'acte'
    ? ({ birth: 'Naissance', death: 'Décès', marriage: 'Mariage', other: 'Autre' }[attachment.acteType || ''] ?? 'Acte')
    : null;

  return (
    <button onClick={onClick}
      className="group relative rounded-md border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[var(--accent)] hover:shadow-md transition-all text-left">
      <div className="aspect-square bg-[var(--bg)] grid place-items-center overflow-hidden">
        {isImage && src && <img src={src} alt={attachment.filename} className="w-full h-full object-cover" />}
        {isPdf && (
          <div className="flex flex-col items-center text-[var(--ink-faint)]">
            <Icon.FileText className="size-8 mb-1" />
            <span className="text-[10px] font-mono">PDF</span>
          </div>
        )}
        {!isImage && !isPdf && <Icon.FileText className="size-6 text-[var(--ink-faint)]" />}
        <span className="absolute top-1 right-1 text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition">
          {attachment.storage === 'cloud' ? '☁' : '💾'}
        </span>
        {acteLabel && (
          <span className="absolute bottom-1 left-1 text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-black/60 text-white">
            {acteLabel}
          </span>
        )}
      </div>
      <div className="px-2 py-1.5 text-[11px] truncate text-[var(--ink-muted)]">
        {attachment.description?.split('\n')[0] || attachment.filename}
      </div>
    </button>
  );
}
