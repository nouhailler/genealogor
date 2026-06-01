import { useState } from 'react';
import { Icon } from '@/components/ui-kit';

interface Props {
  onDecrypt: (passphrase: string) => Promise<void>;
  onCancel: () => void;
  error: string | null;
  loading: boolean;
}

export default function PassphraseScreen({ onDecrypt, onCancel, error, loading }: Props) {
  const [passphrase, setPassphrase] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passphrase.trim()) return;
    await onDecrypt(passphrase);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] px-4 py-12">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-[var(--ink)] tracking-tight">Genealogor</h1>
        <p className="text-sm text-[var(--ink-muted)] mt-1">Données familiales chiffrées</p>
      </header>

      <div className="w-full max-w-sm bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="size-9 rounded-lg bg-[color:var(--accent-soft)] flex items-center justify-center shrink-0">
            <Icon.Lock className="size-4 text-[var(--accent)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--ink)]">Accès protégé</p>
            <p className="text-xs text-[var(--ink-muted)]">Saisissez la phrase secrète pour déchiffrer</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1">
              Phrase secrète
            </label>
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={passphrase}
              onChange={e => setPassphrase(e.target.value)}
              disabled={loading}
              placeholder="••••••••••••"
              className="w-full h-10 px-3 rounded-md bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--ink-faint)] disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-[var(--danger)]">
              <Icon.AlertTriangle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 h-10 rounded-md text-sm text-[var(--ink-muted)] border border-[var(--border)] hover:border-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !passphrase.trim()}
              className="flex-1 h-10 rounded-md text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-block size-4 border-2 border-white border-t-transparent rounded-full" style={{ animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <Icon.Check className="size-4" />
              )}
              {loading ? 'Déchiffrement…' : 'Accéder'}
            </button>
          </div>
        </form>

        <p className="mt-5 text-[10.5px] text-[var(--ink-faint)] text-center leading-relaxed">
          Les données restent dans votre navigateur&nbsp;;<br />rien n'est envoyé à un serveur.
        </p>
      </div>
    </div>
  );
}
