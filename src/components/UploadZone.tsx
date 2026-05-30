import { useRef, useState, useCallback } from 'react';

interface Props {
  onFiles: (files: File[]) => void;
  onLoadSample: () => void;
}

export default function UploadZone({ onFiles, onLoadSample }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = useCallback((files: FileList | null) => {
    setError('');
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    for (const f of arr) {
      const lower = f.name.toLowerCase();
      if (!lower.endsWith('.ged') && !lower.endsWith('.gedcom') && !lower.endsWith('.csv')) {
        setError(`"${f.name}" n'est pas un fichier GEDCOM (.ged) ou CSV (.csv).`);
        return;
      }
      if (f.size > 50 * 1024 * 1024) {
        setError(`"${f.name}" est trop volumineux (max 50 Mo).`);
        return;
      }
    }
    onFiles(arr);
  }, [onFiles]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`
          group relative cursor-pointer rounded-xl border border-dashed transition-colors
          px-6 py-12 sm:px-8 sm:py-16 text-center
          ${drag
            ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
            : 'border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--surface)] active:bg-[var(--surface-hover)]'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".ged,.gedcom,.csv,text/plain,text/csv"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-4">
          <div className="size-14 sm:size-12 rounded-full grid place-items-center bg-[var(--accent-soft)] text-[var(--accent)]">
            <svg className="size-6 sm:size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div>
            <div className="text-base font-medium text-[var(--ink)]">
              <span className="hidden sm:inline">
                Glissez-déposez vos fichiers <span className="font-mono">.ged</span> ou <span className="font-mono">.csv</span>
              </span>
              <span className="sm:hidden">
                Choisir un fichier <span className="font-mono">.ged</span> ou <span className="font-mono">.csv</span>
              </span>
            </div>
            <div className="text-sm text-[var(--ink-muted)] mt-1.5">
              <span className="hidden sm:inline">ou cliquez pour parcourir — fusion automatique si plusieurs fichiers.</span>
              <span className="sm:hidden">Touchez pour parcourir vos fichiers.</span>
            </div>
          </div>
          <div className="text-[10.5px] sm:text-[11px] font-mono text-[var(--ink-faint)] tracking-wide uppercase">
            GEDCOM 5.5.1 · CSV · UTF-8 · max 50 Mo
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
          <svg className="size-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>{error}</div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-center gap-3 text-sm">
        <span className="text-[var(--ink-faint)]">Pas de fichier sous la main ?</span>
        <button
          onClick={(e) => { e.stopPropagation(); onLoadSample(); }}
          className="font-medium text-[var(--accent)] hover:underline underline-offset-4"
        >
          Charger un jeu de démonstration →
        </button>
      </div>
    </div>
  );
}
