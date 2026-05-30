// Attachment detail modal — viewer, description editor, comments, OCR, fact citation.
import { useState, useEffect, useCallback } from 'react';
import { Icon } from '@/components/ui-kit';
import {
  getAttachment, updateAttachment, addComment, removeComment,
  deleteAttachment, downloadAttachment, resolveSrc,
} from '@/lib/attachment-store';
import type { Attachment, FactKind } from '@/lib/attachment-store';
import { extractActFromImage } from '@/lib/ai-features';
import type { OcrResult } from '@/lib/ai-features';

interface Props {
  attachmentId: number;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function AttachmentDetail({ attachmentId, onClose, onUpdate }: Props) {
  const [att, setAtt] = useState<Attachment | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [draftDesc, setDraftDesc] = useState('');
  const [draftComment, setDraftComment] = useState('');
  const [author, setAuthor] = useState(() => {
    try { return localStorage.getItem('genealogor.commentAuthor') || ''; } catch { return ''; }
  });
  const [cloudUrlDraft, setCloudUrlDraft] = useState('');
  const [showCloudInput, setShowCloudInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const a = await getAttachment(attachmentId);
    setAtt(a ?? null);
    setDraftDesc(a?.description || '');
    if (a) {
      const url = await resolveSrc(a);
      setSrc(url);
    }
  }, [attachmentId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    return () => {
      if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
    };
  }, [src]);

  if (!att) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center" onClick={onClose}>
        <div className="bg-[var(--bg)] border border-[var(--border)] rounded-md p-6 w-72 text-center text-sm text-[var(--ink-muted)]" onClick={(e) => e.stopPropagation()}>
          Chargement…
        </div>
      </div>
    );
  }

  const isImage = att.mimeType?.startsWith('image/');
  const isPdf = att.mimeType === 'application/pdf';

  const saveDesc = async () => {
    if (draftDesc === att.description) return;
    setSaving(true);
    await updateAttachment(att.id!, { description: draftDesc });
    await refresh();
    setSaving(false);
    onUpdate?.();
  };

  const submitComment = async () => {
    if (!draftComment.trim()) return;
    try { localStorage.setItem('genealogor.commentAuthor', author); } catch { /* ignore */ }
    await addComment(att.id!, { text: draftComment, author });
    setDraftComment('');
    await refresh();
    onUpdate?.();
  };

  const deleteComment = async (commentId: string) => {
    await removeComment(att.id!, commentId);
    await refresh();
    onUpdate?.();
  };

  const moveToCloud = async () => {
    if (!cloudUrlDraft.trim()) return;
    await updateAttachment(att.id!, { storage: 'cloud', cloudUrl: cloudUrlDraft.trim(), blob: undefined });
    setCloudUrlDraft('');
    setShowCloudInput(false);
    await refresh();
    onUpdate?.();
  };

  const remove = async () => {
    if (!confirm('Supprimer cette pièce jointe ?')) return;
    await deleteAttachment(att.id!);
    onUpdate?.();
    onClose();
  };

  const runOcr = async () => {
    if (!isImage || !src) return;
    setOcrLoading(true);
    setOcrError(null);
    setOcr(null);
    try {
      const resp = await fetch(src);
      const blob = await resp.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
      const result = await extractActFromImage(dataUrl, att.mimeType || blob.type);
      if (result?.error) {
        setOcrError(result.error);
      } else {
        setOcr(result);
        if (!att.factKind && result.actType) {
          const map: Record<string, FactKind> = { naissance: 'birth', mariage: 'marriage', décès: 'death' };
          const fk = map[result.actType];
          if (fk) { await updateAttachment(att.id!, { factKind: fk }); await refresh(); onUpdate?.(); }
        }
      }
    } catch (e) {
      setOcrError(e instanceof Error ? e.message : 'Erreur OCR');
    } finally {
      setOcrLoading(false);
    }
  };

  const kindLabel = att.kind === 'acte'
    ? `Acte${att.acteType ? ' · ' + ({ birth: 'naissance', death: 'décès', marriage: 'mariage', other: 'autre' }[att.acteType] || att.acteType) : ''}`
    : 'Photo';

  const FACT_KINDS: Array<[string, string]> = [
    ['', 'Aucun'], ['birth', 'Naissance'], ['marriage', 'Mariage'],
    ['death', 'Décès'], ['occupation', 'Profession'], ['residence', 'Résidence'], ['other', 'Autre'],
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg)] rounded-lg border border-[var(--border)] shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Icon.FileText className="size-4 text-[var(--accent)] shrink-0" />
            <div className="min-w-0">
              <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">{kindLabel}</div>
              <div className="text-sm font-medium text-[var(--ink)] truncate">{att.filename}</div>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase tracking-wider ${att.storage === 'cloud' ? 'bg-[color:var(--accent)]/10 text-[var(--accent)]' : 'bg-[var(--surface-hover)] text-[var(--ink-muted)]'}`}>
              {att.storage === 'cloud' ? '☁ cloud' : '💾 local'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => void downloadAttachment(att)}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]">
              <Icon.Download className="size-3.5" />
              <span className="hidden sm:inline">Télécharger</span>
            </button>
            <button onClick={() => void remove()}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium text-[var(--ink-muted)] hover:bg-[color:var(--danger)]/10 hover:text-[var(--danger)]">
              <Icon.X className="size-3.5" />
              <span className="hidden sm:inline">Supprimer</span>
            </button>
            <button onClick={onClose} className="size-8 grid place-items-center rounded-md text-[var(--ink-faint)] hover:bg-[var(--surface-hover)]">
              <Icon.X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Viewer */}
          <div className="bg-black/5 grid place-items-center p-4 min-h-[200px]">
            {isImage && src && <img src={src} alt={att.filename} className="max-h-[60vh] max-w-full object-contain rounded shadow-lg" />}
            {isPdf && src && <iframe src={src} className="w-full h-[60vh] rounded shadow-lg" title={att.filename} />}
            {!isImage && !isPdf && (
              <div className="text-center text-sm text-[var(--ink-muted)] py-12">
                <Icon.FileText className="size-12 mx-auto mb-3 opacity-50" />
                <div>Prévisualisation non disponible</div>
                <div className="text-xs font-mono mt-1">{att.mimeType}</div>
              </div>
            )}
          </div>

          {/* Description */}
          <section className="px-5 py-4 border-b border-[var(--border)]">
            <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-2">Descriptif</div>
            <textarea
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              onBlur={() => void saveDesc()}
              placeholder="Ajoutez un descriptif… (date, lieu, contexte, source)"
              rows={3}
              className="w-full px-3 py-2 rounded-md bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)] resize-y"
            />
            <div className="text-[10.5px] font-mono text-[var(--ink-faint)] mt-1.5 flex justify-between">
              <span>{saving ? 'Enregistrement…' : draftDesc !== att.description ? 'Modifié (sauvegarde au blur)' : ''}</span>
              <span>{draftDesc.length} caractères</span>
            </div>
          </section>

          {/* OCR */}
          {isImage && (
            <section className="px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">
                  Lecture automatique de l'acte (OCR)
                </div>
                {(ocr || ocrError) && (
                  <button onClick={() => void runOcr()} disabled={ocrLoading} className="text-[11px] font-mono text-[var(--ink-muted)] hover:text-[var(--ink)] hover:underline">
                    {ocrLoading ? '…' : 'Relancer'}
                  </button>
                )}
              </div>
              {!ocr && !ocrError && (
                <button onClick={() => void runOcr()} disabled={ocrLoading}
                  className="rounded-md border border-dashed border-[var(--border)] hover:border-[var(--accent)] px-4 py-4 w-full text-sm text-[var(--ink-muted)] hover:text-[var(--accent)] disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                  <Icon.Sparkles className="size-4" />
                  {ocrLoading ? 'Lecture en cours…' : 'Lire l\'acte et pré-remplir les champs'}
                </button>
              )}
              {ocrError && (
                <div className="text-sm text-[var(--danger)] rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
                  {ocrError}
                  <div className="text-[10.5px] font-mono text-[var(--ink-faint)] mt-1">
                    L'OCR nécessite un modèle vision (OpenRouter ou Ollama llava). Configurez-le dans les Paramètres.
                  </div>
                </div>
              )}
              {ocr && <OcrDisplay ocr={ocr} />}
            </section>
          )}

          {/* Fact citation */}
          <section className="px-5 py-4 border-b border-[var(--border)]">
            <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-2">
              Citation — quel événement cette pièce documente-t-elle ?
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FACT_KINDS.map(([k, label]) => {
                const isActive = (att.factKind || '') === k;
                return (
                  <button
                    key={k}
                    onClick={() => void updateAttachment(att.id!, { factKind: (k as FactKind) || null }).then(refresh).then(() => onUpdate?.())}
                    className="text-[12px] px-2.5 py-1 rounded-full transition-colors"
                    style={{
                      background: isActive ? 'var(--accent)' : 'var(--surface)',
                      color: isActive ? 'var(--accent-ink, white)' : 'var(--ink-muted)',
                      border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Comments */}
          <section className="px-5 py-4 border-b border-[var(--border)]">
            <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-3">
              Commentaires ({att.comments?.length || 0})
            </div>
            <div className="space-y-2 mb-3">
              {(att.comments || []).map((c) => (
                <div key={c.id} className="group rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <div className="text-xs font-medium text-[var(--ink)]">{c.author || <span className="text-[var(--ink-faint)] italic">anonyme</span>}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[var(--ink-faint)]">
                        {new Date(c.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                      <button onClick={() => void deleteComment(c.id)}
                        className="opacity-0 group-hover:opacity-100 text-[var(--ink-faint)] hover:text-[var(--danger)]">
                        <Icon.X className="size-3" />
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-[var(--ink)] whitespace-pre-wrap leading-relaxed">{c.text}</div>
                </div>
              ))}
              {(!att.comments || att.comments.length === 0) && (
                <div className="text-xs text-[var(--ink-faint)] italic">Aucun commentaire pour le moment.</div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Votre nom"
                  className="w-40 h-8 px-2 rounded border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]" />
                <textarea value={draftComment} onChange={(e) => setDraftComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submitComment(); } }}
                  placeholder="Ajouter un commentaire… (Cmd/Ctrl+Entrée)"
                  rows={2}
                  className="flex-1 px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--accent)] resize-y"
                />
              </div>
              <div className="flex justify-end">
                <button onClick={() => void submitComment()} disabled={!draftComment.trim()}
                  className="text-xs font-medium px-3 py-1.5 rounded bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
                  Publier
                </button>
              </div>
            </div>
          </section>

          {/* Storage */}
          <section className="px-5 py-4">
            <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-2">Stockage</div>
            {att.storage === 'local' ? (
              <div className="space-y-2">
                <div className="text-xs text-[var(--ink-muted)]">
                  Fichier stocké sur cet appareil (IndexedDB, {(att.size / 1024).toFixed(0)} Ko).
                </div>
                {!showCloudInput ? (
                  <button onClick={() => setShowCloudInput(true)} className="text-xs text-[var(--accent)] hover:underline">
                    Déplacer vers un stockage cloud (URL externe)…
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <input value={cloudUrlDraft} onChange={(e) => setCloudUrlDraft(e.target.value)}
                      placeholder="https://votre-cloud.com/photo.jpg"
                      className="flex-1 h-8 px-2 rounded border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]" />
                    <button onClick={() => void moveToCloud()} disabled={!cloudUrlDraft.trim()}
                      className="text-xs font-medium px-3 rounded bg-[var(--accent)] text-[var(--accent-ink)] disabled:opacity-40">
                      Lier
                    </button>
                    <button onClick={() => { setShowCloudInput(false); setCloudUrlDraft(''); }}
                      className="text-xs text-[var(--ink-muted)] px-2 hover:text-[var(--ink)]">
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-[var(--ink-muted)] break-all">
                Fichier hébergé sur :{' '}
                <a href={att.cloudUrl} target="_blank" rel="noreferrer" className="font-mono text-[var(--accent)] hover:underline">
                  {att.cloudUrl}
                </a>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ── OCR display ───────────────────────────────────────────────────────────────

function OcrDisplay({ ocr }: { ocr: OcrResult }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {ocr.actType && (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)' }}>
            Type : {ocr.actType}
          </span>
        )}
        {ocr.confidence != null && (
          <span className="text-[10.5px] font-mono text-[var(--ink-faint)]">confiance {ocr.confidence}%</span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
        {ocr.date && <OcrField label="Date" value={ocr.date} />}
        {ocr.place && <OcrField label="Lieu" value={ocr.place} />}
        {ocr.principal?.given && <OcrField label="Prénom" value={ocr.principal.given} />}
        {ocr.principal?.surname && <OcrField label="Nom" value={ocr.principal.surname} />}
        {ocr.principal?.age && <OcrField label="Âge" value={ocr.principal.age} />}
        {ocr.principal?.profession && <OcrField label="Profession" value={ocr.principal.profession} />}
        {ocr.spouse?.given && <OcrField label="Conjoint·e" value={`${ocr.spouse.given} ${ocr.spouse.surname || ''}`} />}
      </div>
      {ocr.parents && ocr.parents.length > 0 && (
        <div className="text-[13px]">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">Parents</span>
          <div className="mt-0.5 flex flex-col gap-0.5">
            {ocr.parents.map((p, i) => (
              <div key={i} className="text-[var(--ink)]">
                {p.given} {p.surname}{p.role ? <span className="text-[var(--ink-faint)]"> ({p.role})</span> : null}
              </div>
            ))}
          </div>
        </div>
      )}
      {ocr.witnesses && ocr.witnesses.length > 0 && (
        <div className="text-[13px]">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">Témoins</span>
          <div className="text-[var(--ink-muted)] mt-0.5">{ocr.witnesses.join(', ')}</div>
        </div>
      )}
      {ocr.notes && <div className="text-[12px] text-[var(--ink-muted)] italic border-t border-[var(--border)] pt-2">{ocr.notes}</div>}
      <div className="text-[10px] font-mono text-[var(--ink-faint)] pt-1">
        Extraction IA — à vérifier contre l'original avant toute saisie définitive.
      </div>
    </div>
  );
}

function OcrField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-faint)] shrink-0">{label}</span>
      <span className="text-[var(--ink)]">{value}</span>
    </div>
  );
}
