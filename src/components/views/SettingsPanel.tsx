import { useState, useEffect } from 'react';
import { Icon } from '@/components/ui-kit';
import { loadSettings, saveSettings, type Settings, type ProviderId, type ProviderSettings } from '@/lib/ai-client';
import { getGPhotosProxy, setGPhotosProxy, DEFAULT_GPHOTOS_PROXY } from '@/lib/gphotos';

// ── Sub-components ────────────────────────────────────────────────────────────

interface FieldProps { label: string; hint?: string; children: React.ReactNode }
function Field({ label, hint, children }: FieldProps) {
  return (
    <div>
      <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-[10.5px] font-mono text-[var(--ink-faint)] mt-1">{hint}</div>}
    </div>
  );
}

const INPUT_CLS = 'w-full h-9 px-3 rounded-md bg-[var(--surface)] border border-[var(--border)] text-sm font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]';

// ── Provider forms ────────────────────────────────────────────────────────────

function ClaudeForm({ settings, onChange }: { settings: ProviderSettings; onChange: (p: Partial<ProviderSettings>) => void }) {
  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--ink-muted)] leading-relaxed">
        API directe <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">Anthropic</a>.
        Modèles disponibles : Haiku (rapide, économique), Sonnet, Opus.
      </div>
      <Field label="Clé API Anthropic" hint="Commence par sk-ant-… · Obtenez la vôtre sur console.anthropic.com">
        <input type="password" value={settings.apiKey || ''} onChange={(e) => onChange({ apiKey: e.target.value })}
          placeholder="sk-ant-…" className={INPUT_CLS} />
      </Field>
      <Field label="Modèle">
        <input type="text" value={settings.model || ''} onChange={(e) => onChange({ model: e.target.value })}
          placeholder="claude-haiku-4-5-20251001" className={INPUT_CLS} />
      </Field>
    </div>
  );
}

function OpenAIForm({ settings, onChange }: { settings: ProviderSettings; onChange: (p: Partial<ProviderSettings>) => void }) {
  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--ink-muted)] leading-relaxed">
        API directe <a href="https://platform.openai.com" target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">OpenAI</a>.
        Modèles disponibles : GPT-4o mini (recommandé), GPT-4o, GPT-4 Turbo.
      </div>
      <Field label="Clé API OpenAI" hint="Commence par sk-… · Obtenez la vôtre sur platform.openai.com/api-keys">
        <input type="password" value={settings.apiKey || ''} onChange={(e) => onChange({ apiKey: e.target.value })}
          placeholder="sk-…" className={INPUT_CLS} />
      </Field>
      <Field label="Modèle">
        <input type="text" value={settings.model || ''} onChange={(e) => onChange({ model: e.target.value })}
          placeholder="gpt-4o-mini" className={INPUT_CLS} />
      </Field>
    </div>
  );
}

function OpenRouterForm({ settings, onChange }: { settings: ProviderSettings; onChange: (p: Partial<ProviderSettings>) => void }) {
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<Array<{ id: string; name?: string; context_length?: number; pricing?: { prompt: string; completion: string } }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const apiKey = settings.apiKey || '';
  const model = settings.model || '';

  const fetchModels = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { data?: typeof models };
      const freeModels = (data.data || []).filter((m) =>
        m.id?.endsWith(':free') || (m.pricing?.prompt === '0' && m.pricing?.completion === '0')
      );
      setModels(freeModels);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (apiKey && !models) fetchModels(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = models
    ? models.filter((m) =>
        !filter.trim() ||
        (m.id || '').toLowerCase().includes(filter.toLowerCase()) ||
        (m.name || '').toLowerCase().includes(filter.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--ink-muted)] leading-relaxed">
        <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">OpenRouter</a> donne accès à de nombreux modèles via une seule clé. Plusieurs sont gratuits (suffixe <code className="font-mono text-[var(--ink)] bg-[var(--surface)] px-1 rounded">:free</code>).
      </div>
      <Field label="Clé API OpenRouter" hint="Commence par sk-or-v1-… · openrouter.ai/keys">
        <input type="password" value={apiKey} onChange={(e) => onChange({ apiKey: e.target.value })}
          placeholder="sk-or-v1-…" className={INPUT_CLS} />
      </Field>
      <Field label={`Modèles gratuits${models ? ` (${filtered.length}/${models.length})` : ''}`}>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrer (ex: llama, mistral, gemma…)"
              className="flex-1 h-8 px-2 rounded border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]" />
            <button onClick={fetchModels} disabled={loading}
              className="text-xs font-medium px-3 rounded border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--ink-muted)] disabled:opacity-50">
              {loading ? '…' : models ? 'Recharger' : 'Charger'}
            </button>
          </div>
          {error && (
            <div className="text-xs font-mono rounded-md px-3 py-2 bg-[color:var(--danger)]/10 text-[var(--danger)]">{error}</div>
          )}
          {models && (
            <div className="rounded-md border border-[var(--border)] divide-y divide-[var(--border)] max-h-60 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="text-center text-xs text-[var(--ink-faint)] py-4 italic">Aucun modèle ne correspond</div>
              )}
              {filtered.map((m) => {
                const selected = model === m.id;
                const ctxK = m.context_length ? Math.round(m.context_length / 1000) : null;
                return (
                  <button key={m.id} onClick={() => onChange({ model: m.id })}
                    className={`w-full text-left px-3 py-2 hover:bg-[var(--surface-hover)] ${selected ? 'bg-[color:var(--accent)]/10' : ''}`}>
                    <div className="flex items-start gap-2">
                      <div className={`size-3.5 mt-0.5 rounded-full border-2 shrink-0 ${selected ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border)]'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3 flex-wrap">
                          <div className="text-sm font-medium text-[var(--ink)] truncate">{m.name || m.id}</div>
                          {ctxK && (
                            <div className="text-[10px] font-mono text-[var(--ink-faint)] shrink-0">
                              {ctxK >= 1000 ? `${(ctxK / 1000).toFixed(0)}M` : `${ctxK}K`} ctx
                            </div>
                          )}
                        </div>
                        <div className="text-[10.5px] font-mono text-[var(--ink-faint)] mt-0.5 truncate">{m.id}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {model && !models && (
            <div className="text-xs font-mono text-[var(--ink-muted)] px-1">Modèle actuel : {model}</div>
          )}
        </div>
      </Field>
    </div>
  );
}

function OllamaForm({ settings, onChange }: { settings: ProviderSettings; onChange: (p: Partial<ProviderSettings>) => void }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [availableModels, setAvailableModels] = useState<Array<{ name: string; size?: number }> | null>(null);

  const baseUrl = settings.baseUrl || 'http://localhost:11434';
  const model = settings.model || 'llama3.2';
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  const test = async () => {
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch(`${baseUrl}/api/tags`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { models?: Array<{ name: string; size?: number }> };
      setAvailableModels(data.models || []);
      setTestResult({ ok: true, message: `Connecté · ${data.models?.length || 0} modèles disponibles` });
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : 'Connexion échouée' });
    } finally { setTesting(false); }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--ink-muted)] leading-relaxed">
        <a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">Ollama</a> tourne localement sur votre machine. Privé, gratuit, mais nécessite une installation.
      </div>

      {isHttps && (
        <div className="flex gap-2.5 rounded-md border border-[color:var(--warn)]/40 bg-[color:var(--warn)]/8 px-3 py-2.5">
          <span className="text-[var(--warn)] text-sm shrink-0">⚠️</span>
          <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
            Ollama en local (<code className="font-mono">http://localhost</code>) est <strong>bloqué par le navigateur</strong> depuis un site HTTPS (mixed content). Cette option ne fonctionne que lorsque l'application tourne en local (<code className="font-mono">npm run dev</code>).
          </p>
        </div>
      )}

      <Field label="URL de base">
        <input type="text" value={baseUrl} onChange={(e) => onChange({ baseUrl: e.target.value })}
          placeholder="http://localhost:11434" className={INPUT_CLS} />
      </Field>
      <Field label="Modèle">
        {availableModels && availableModels.length > 0 ? (
          <select value={model} onChange={(e) => onChange({ model: e.target.value })} className={INPUT_CLS}>
            {availableModels.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}{m.size ? ` · ${(m.size / 1e9).toFixed(1)} Go` : ''}
              </option>
            ))}
          </select>
        ) : (
          <input type="text" value={model} onChange={(e) => onChange({ model: e.target.value })}
            placeholder="llama3.2, mistral, qwen2.5, …" className={INPUT_CLS} />
        )}
      </Field>
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={test} disabled={testing}
          className="text-xs font-medium px-3 py-1.5 rounded border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--ink-muted)] disabled:opacity-50">
          {testing ? 'Test en cours…' : 'Tester la connexion'}
        </button>
      </div>
      {testResult && (
        <div className={`text-xs font-mono rounded-md px-3 py-2 ${testResult.ok ? 'bg-[color:var(--success)]/10 text-[var(--success)]' : 'bg-[color:var(--danger)]/10 text-[var(--danger)]'}`}>
          {testResult.message}
        </div>
      )}
      <div className="text-[10.5px] font-mono text-[var(--ink-faint)] italic leading-relaxed">
        CORS : lancez Ollama avec <code className="text-[var(--ink-muted)]">OLLAMA_ORIGINS=* ollama serve</code>
      </div>
    </div>
  );
}

// ── Main SettingsPanel ────────────────────────────────────────────────────────

interface Props { onClose: () => void }

const PROVIDERS: { id: ProviderId; label: string; sublabel: string }[] = [
  { id: 'claude',      label: 'Claude',      sublabel: 'Anthropic' },
  { id: 'openai',      label: 'ChatGPT',     sublabel: 'OpenAI' },
  { id: 'openrouter',  label: 'OpenRouter',  sublabel: 'Multi-modèles' },
  { id: 'ollama',      label: 'Ollama',      sublabel: 'Local · privé' },
];

export default function SettingsPanel({ onClose }: Props) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [viewing, setViewing] = useState<ProviderId>(settings.provider || 'claude');
  const [gphotosProxy, setGphotosProxyState] = useState<string>(() => getGPhotosProxy());

  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => { setGPhotosProxy(gphotosProxy); }, [gphotosProxy]);

  const updateProvider = (id: ProviderId, patch: Partial<ProviderSettings>) =>
    setSettings((s) => ({ ...s, [id]: { ...(s[id] || {}), ...patch } }));

  const activate = (id: ProviderId) =>
    setSettings((s) => ({ ...s, provider: id }));

  const isActive = (id: ProviderId) => settings.provider === id;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg)] rounded-lg border border-[var(--border)] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Icon.Settings className="size-4 text-[var(--accent)]" />
            <h3 className="text-sm font-medium text-[var(--ink)]">Paramètres IA</h3>
          </div>
          <button onClick={onClose}
            className="size-8 grid place-items-center rounded-md text-[var(--ink-faint)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]">
            <Icon.X className="size-4" />
          </button>
        </div>

        {/* Provider selector */}
        <div className="px-5 pt-4 pb-3 shrink-0">
          <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-2">Fournisseur</div>
          <div className="grid grid-cols-4 gap-2">
            {PROVIDERS.map(({ id, label, sublabel }) => {
              const active = isActive(id);
              const selected = viewing === id;
              return (
                <button key={id} onClick={() => setViewing(id)}
                  className={[
                    'relative flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2.5 text-center transition-colors',
                    selected
                      ? 'border-[var(--accent)] bg-[color:var(--accent)]/8 text-[var(--ink)]'
                      : 'border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--ink-muted)]',
                  ].join(' ')}>
                  <span className="text-xs font-semibold">{label}</span>
                  <span className="text-[9.5px] font-mono text-[var(--ink-faint)]">{sublabel}</span>
                  {active && (
                    <span className="absolute top-1 right-1 size-1.5 rounded-full bg-[var(--success)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Provider form */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 border-t border-[var(--border)] pt-4">
          {viewing === 'claude' && (
            <ClaudeForm settings={settings.claude || {}} onChange={(p) => updateProvider('claude', p)} />
          )}
          {viewing === 'openai' && (
            <OpenAIForm settings={settings.openai || {}} onChange={(p) => updateProvider('openai', p)} />
          )}
          {viewing === 'openrouter' && (
            <OpenRouterForm settings={settings.openrouter || {}} onChange={(p) => updateProvider('openrouter', p)} />
          )}
          {viewing === 'ollama' && (
            <OllamaForm settings={settings.ollama || {}} onChange={(p) => updateProvider('ollama', p)} />
          )}

          {/* Activate button */}
          <div className="mt-5 pt-4 border-t border-[var(--border)]">
            {isActive(viewing) ? (
              <div className="text-xs font-mono text-[var(--success)] flex items-center gap-2">
                <span className="size-2 rounded-full bg-[var(--success)]" />
                {PROVIDERS.find((p) => p.id === viewing)?.label} est le fournisseur actif
              </div>
            ) : (
              <button onClick={() => activate(viewing)}
                className="text-xs font-medium px-4 py-2 rounded-md bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90">
                Utiliser {PROVIDERS.find((p) => p.id === viewing)?.label}
              </button>
            )}
          </div>

          {/* Google Photos proxy */}
          <div className="mt-5 pt-4 border-t border-[var(--border)] space-y-3">
            <div className="flex items-center gap-2">
              <Icon.Paperclip className="size-4 text-[var(--accent)]" />
              <h4 className="text-sm font-medium text-[var(--ink)]">Google Photos</h4>
            </div>
            <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
              Pour rapatrier les miniatures d'un album partagé par lien, l'application passe par un petit
              relais (les navigateurs ne peuvent pas lire la page d'album directement). Par défaut, une
              <strong> fonction Netlify</strong> intégrée est utilisée. Pour héberger vous-même, indiquez ici
              l'URL de votre propre relais (Express, PHP, nginx <code className="font-mono text-[var(--ink)]">proxy_pass</code>…).
            </p>
            <Field label="URL du relais" hint={`Laissez vide pour la valeur par défaut (${DEFAULT_GPHOTOS_PROXY}).`}>
              <input type="text" value={gphotosProxy === DEFAULT_GPHOTOS_PROXY ? '' : gphotosProxy}
                onChange={(e) => setGphotosProxyState(e.target.value.trim() || DEFAULT_GPHOTOS_PROXY)}
                placeholder={DEFAULT_GPHOTOS_PROXY} className={INPUT_CLS} />
            </Field>
          </div>
        </div>

        {/* Footer — privacy note */}
        <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-[var(--ink-faint)]">
            <Icon.Lock className="size-3 shrink-0" />
            <span>La clé est stockée <strong>uniquement dans votre navigateur</strong> (localStorage) et n'est jamais envoyée ailleurs que vers l'API du fournisseur choisi.</span>
          </div>
          <button onClick={onClose}
            className="shrink-0 text-xs font-mono px-3 py-1.5 rounded bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
