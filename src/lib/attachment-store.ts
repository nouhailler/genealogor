// Attachment storage (photos + actes) backed by IndexedDB.
// Supports local Blob storage and cloud URL references.
import JSZip from 'jszip';

const DB_NAME = 'genealogor';
const DB_VERSION = 2;
const STORE = 'media';

export type AttachmentKind = 'photo' | 'acte';
export type FactKind = 'birth' | 'death' | 'marriage' | 'occupation' | 'residence' | 'other';

export interface AttachmentComment {
  id: string;
  text: string;
  author: string;
  createdAt: number;
}

export interface Attachment {
  id?: number;
  personId: string;
  kind: AttachmentKind;
  acteType: string | null;
  factKind: FactKind | null;
  description: string;
  comments: AttachmentComment[];
  addedAt: number;
  storage: 'local' | 'cloud';
  filename: string;
  mimeType: string;
  size: number;
  blob?: File | Blob;
  cloudUrl?: string;
}

// ── IndexedDB helpers ──────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      const tx = (e.target as IDBOpenDBRequest).transaction!;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        os.createIndex('personId', 'personId', { unique: false });
        os.createIndex('kind', 'kind', { unique: false });
      } else {
        const os = tx.objectStore(STORE);
        if (!os.indexNames.contains('kind')) os.createIndex('kind', 'kind', { unique: false });
        const cursor = os.openCursor();
        cursor.onsuccess = (ev) => {
          const c = (ev.target as IDBRequest<IDBCursorWithValue>).result;
          if (!c) return;
          const v = c.value as Partial<Attachment>;
          let changed = false;
          if (v.kind == null) { v.kind = 'photo'; changed = true; }
          if (v.description == null) { (v as Record<string, unknown>).description = (v as Record<string, unknown>).caption || ''; changed = true; }
          if (!Array.isArray(v.comments)) { v.comments = []; changed = true; }
          if (v.storage == null) { v.storage = v.blob ? 'local' : 'cloud'; changed = true; }
          if (changed) c.update(v);
          c.continue();
        };
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function notifyChange(): void {
  try { window.dispatchEvent(new Event('genealogor-attachments-changed')); } catch { /* ignore */ }
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface AddAttachmentOptions {
  personId: string;
  kind?: AttachmentKind;
  acteType?: string;
  factKind?: FactKind;
  file?: File;
  cloudUrl?: string;
  description?: string;
}

export async function addAttachment({ personId, kind, acteType, factKind, file, cloudUrl, description }: AddAttachmentOptions): Promise<number> {
  if (!personId) throw new Error('personId requis');
  const base = {
    personId,
    kind: kind || 'photo' as AttachmentKind,
    acteType: acteType || null,
    factKind: factKind || null,
    description: description || '',
    comments: [] as AttachmentComment[],
    addedAt: Date.now(),
  };
  let record: Omit<Attachment, 'id'>;
  if (file) {
    record = { ...base, storage: 'local', filename: file.name, mimeType: file.type, size: file.size, blob: file };
  } else if (cloudUrl) {
    const u = cloudUrl.trim();
    const filename = (u.split('/').pop() || 'fichier').split('?')[0];
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const mimeGuess: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf' };
    record = { ...base, storage: 'cloud', cloudUrl: u, filename, mimeType: mimeGuess[ext] || 'application/octet-stream', size: 0 };
  } else {
    throw new Error('file ou cloudUrl requis');
  }
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const id = await reqToPromise(tx.objectStore(STORE).add(record)) as number;
  notifyChange();
  return id;
}

export async function updateAttachment(id: number, patch: Partial<Attachment>): Promise<Attachment> {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const existing = await reqToPromise(store.get(id)) as Attachment;
  if (!existing) throw new Error('Pièce jointe introuvable');
  const merged = { ...existing, ...patch };
  await reqToPromise(store.put(merged));
  notifyChange();
  return merged;
}

export async function addComment(id: number, { text, author }: { text: string; author?: string }): Promise<AttachmentComment[]> {
  if (!text?.trim()) return [];
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const existing = await reqToPromise(store.get(id)) as Attachment;
  if (!existing) throw new Error('Pièce jointe introuvable');
  const comments = Array.isArray(existing.comments) ? existing.comments : [];
  comments.push({
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: text.trim(),
    author: author || '',
    createdAt: Date.now(),
  });
  await reqToPromise(store.put({ ...existing, comments }));
  return comments;
}

export async function removeComment(id: number, commentId: string): Promise<AttachmentComment[]> {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const existing = await reqToPromise(store.get(id)) as Attachment | undefined;
  if (!existing) return [];
  const comments = (existing.comments || []).filter((c) => c.id !== commentId);
  await reqToPromise(store.put({ ...existing, comments }));
  return comments;
}

export async function deleteAttachment(id: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  await reqToPromise(tx.objectStore(STORE).delete(id));
  notifyChange();
}

export async function getAttachment(id: number): Promise<Attachment | undefined> {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  return reqToPromise(tx.objectStore(STORE).get(id)) as Promise<Attachment | undefined>;
}

export async function listForPerson(personId: string, kind?: AttachmentKind): Promise<Attachment[]> {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  const idx = tx.objectStore(STORE).index('personId');
  const all = await reqToPromise(idx.getAll(personId)) as Attachment[];
  return kind ? all.filter((a) => a.kind === kind) : all;
}

export async function listAll(): Promise<Attachment[]> {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  return reqToPromise(tx.objectStore(STORE).getAll()) as Promise<Attachment[]>;
}

export async function resolveSrc(att: Attachment | null | undefined): Promise<string | null> {
  if (!att) return null;
  if (att.storage === 'cloud') return att.cloudUrl ?? null;
  if (att.blob) return URL.createObjectURL(att.blob);
  return null;
}

export async function downloadAttachment(att: Attachment): Promise<void> {
  if (!att) return;
  if (att.storage === 'cloud') {
    window.open(att.cloudUrl, '_blank');
    return;
  }
  if (!att.blob) return;
  const url = URL.createObjectURL(att.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = att.filename || 'fichier';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

export async function exportPersonZip(personId: string, personName: string): Promise<void> {
  const items = await listForPerson(personId);
  if (items.length === 0) throw new Error('Aucune pièce jointe à exporter');
  const zip = new JSZip();
  const meta = {
    personId,
    personName,
    exportedAt: new Date().toISOString(),
    attachments: [] as object[],
  };
  let i = 0;
  for (const att of items) {
    i++;
    const folder = att.kind === 'acte' ? 'actes' : 'photos';
    const base = `${String(i).padStart(2, '0')}-${(att.filename || 'fichier').replace(/[\/\\?%*:|"<>]/g, '_')}`;
    if (att.storage === 'local' && att.blob) {
      zip.file(`${folder}/${base}`, att.blob);
    }
    meta.attachments.push({
      file: `${folder}/${base}`,
      kind: att.kind,
      acteType: att.acteType,
      storage: att.storage,
      cloudUrl: att.cloudUrl || null,
      description: att.description || '',
      comments: att.comments || [],
      addedAt: new Date(att.addedAt).toISOString(),
    });
  }
  zip.file('metadata.json', JSON.stringify(meta, null, 2));
  const blob = await zip.generateAsync({ type: 'blob' });
  const safeName = (personName || personId).replace(/[\/\\?%*:|"<>]/g, '_');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${safeName}-dossier-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 200);
}

export async function countByFact(personId: string): Promise<Record<string, number>> {
  const list = await listForPerson(personId);
  const out: Record<string, number> = { birth: 0, death: 0, marriage: 0, occupation: 0, residence: 0, other: 0, unlinked: 0 };
  for (const a of list) {
    const k = a.factKind;
    if (k && out[k] != null) out[k]++;
    else out.unlinked++;
  }
  return out;
}

export const AttachmentStore = {
  addAttachment,
  updateAttachment,
  addComment,
  removeComment,
  deleteAttachment,
  getAttachment,
  listForPerson,
  listAll,
  resolveSrc,
  downloadAttachment,
  exportPersonZip,
  countByFact,
};
