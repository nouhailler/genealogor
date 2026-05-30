import { useState, useEffect } from 'react';
import { Icon } from '@/components/ui-kit';

// ── Settings storage ──────────────────────────────────────────────────────────

const SETTINGS_KEY = 'genealogor.aiSettings';

interface ProviderSettings {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}

interface Settings {
  provider?: 'claude' | 'ollama' | 'openrouter';
  ollama?: ProviderSettings;
  openrouter?: ProviderSettings;
}

function loadSettings(): Settings {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as Settings;
  } catch { return {}; }
}

function saveSettings(s: Settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function getActive(): ({ provider: string } & ProviderSettings) | null {
  const s = loadSettings();
  return s.provider ? { provider: s.provider, ...(s[s.provider as 'ollama' | 'openrouter'] || {}) } : null;
}

// ── Exported AI functions ─────────────────────────────────────────────────────

export async function aiCall(prompt: string): Promise<string> {
  const active = getActive();
  const provider = active?.provider || 'claude';

  if (provider === 'ollama') {
    const baseUrl = active?.baseUrl || 'http://localhost:11434';
    const model = active?.model || 'llama3.2';
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json() as { response?: string };
    return data.response || '';
  }

  if (provider === 'openrouter') {
    if (!active?.apiKey) throw new Error('Clé API OpenRouter manquante');
    if (!active?.model) throw new Error('Modèle OpenRouter non sélectionné');
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${active.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Genealogor',
      },
      body: JSON.stringify({
        model: active.model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenRouter HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || '';
  }

  throw new Error(`Provider '${provider}' non disponible. Configurez un provider dans les Paramètres.`);
}

export async function aiCallMultimodal(opts: { prompt: string; image?: string; mimeType?: string }): Promise<string> {
  const { prompt, image, mimeType } = opts;
  if (!image) return aiCall(prompt);
  const active = getActive();
  const provider = active?.provider || 'claude';

  const b64 = image.includes(',') ? image.split(',')[1] : image;
  const dataUrl = image.startsWith('data:') ? image : `data:${mimeType || 'image/jpeg'};base64,${b64}`;

  if (provider === 'openrouter') {
    if (!active?.apiKey) throw new Error('Clé API OpenRouter manquante');
    if (!active?.model) throw new Error('Modèle OpenRouter non sélectionné');
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${active.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Genealogor',
      },
      body: JSON.stringify({
        model: active.model,
        messages: [
          { role: 'user', content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: prompt },
          ] },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenRouter HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || '';
  }

  if (provider === 'ollama') {
    const baseUrl = active?.baseUrl || 'http://localhost:11434';
    const model = active?.model || 'llava';
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, images: [b64], stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json() as { response?: string };
    return data.response || '';
  }

  throw new Error(`Provider '${provider}' ne supporte pas les images ou n'est pas disponible.`);
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface FieldProps { label: string; children: React.ReactNode }
function Field({ label, children }: FieldProps) {
  return (
    <div>
      <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function ClaudeTab({ active, onUse }: { active: boolean; onUse: () => void }) {
  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--ink-muted)] leading-relaxed">
        Utilise l'API <code className="font-mono text-[var(--ink)] bg-[var(--surface)] px-1.5 py-0.5 rounded">window.claude.complete</code> intégrée à l'environnement Claude Design.
        Aucune configuration requise. En production sur Netlify, à remplacer par une Netlify Function appelant l'API Anthropic.
      </div>
      {!active ? (
        <button onClick={onUse}
          className="text-xs font-medium px-3 py-1.5 rounded bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90">
          Utiliser Claude
        </button>
      ) : (
        <div className="text-xs font-mono text-[var(--success)] flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-[var(--success)]" /> Provider actif
        </div>
      )}
    </div>
  );
}

function OllamaTab({ settings, isActive, onChange, onUse }: {
  settings: ProviderSettings;
  isActive: boolean;
  onChange: (p: Partial<ProviderSettings>) => void;
  onUse: () => void;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [availableModels, setAvailableModels] = useState<Array<{ name: string; size?: number }> | null>(null);

  const baseUrl = settings.baseUrl || 'http://localhost:11434';
  const model = settings.model || 'llama3.2';

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${baseUrl}/api/tags`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { models?: Array<{ name: string; size?: number }> };
      setAvailableModels(data.models || []);
      setTestResult({ ok: true, message: `Connecté · ${data.models?.length || 0} modèles disponibles` });
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : 'Connexion échouée' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--ink-muted)] leading-relaxed">
        <a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">Ollama</a> tourne localement sur votre machine. Privé, gratuit, mais nécessite une installation et plus de ressources.
      </div>
      <Field label="URL de base">
        <input type="text" value={baseUrl}
          onChange={(e) => onChange({ baseUrl: e.target.value })}
          placeholder="http://localhost:11434"
          className="w-full h-9 px-3 rounded-md bg-[var(--surface)] border border-[var(--border)] text-sm font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]" />
      </Field>
      <Field label="Modèle">
        {availableModels && availableModels.length > 0 ? (
          <select value={model} onChange={(e) => onChange({ model: e.target.value })}
            className="w-full h-9 px-3 rounded-md bg-[var(--surface)] border border-[var(--border)] text-sm font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]">
            {availableModels.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}{m.size ? ` · ${(m.size / 1e9).toFixed(1)} Go` : ''}
              </option>
            ))}
          </select>
        ) : (
          <input type="text" value={model}
            onChange={(e) => onChange({ model: e.target.value })}
            placeholder="llama3.2, mistral, qwen2.5, …"
            className="w-full h-9 px-3 rounded-md bg-[var(--surface)] border border-[var(--border)] text-sm font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]" />
        )}
      </Field>
      <div className="flex items-center gap-2">
        <button onClick={test} disabled={testing}
          className="text-xs font-medium px-3 py-1.5 rounded border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--ink-muted)] disabled:opacity-50">
          {testing ? 'Test en cours…' : 'Tester la connexion'}
        </button>
        {!isActive ? (
          <button onClick={onUse}
            className="text-xs font-medium px-3 py-1.5 rounded bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90">
            Utiliser Ollama
          </button>
        ) : (
          <span className="text-xs font-mono text-[var(--success)] flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[var(--success)]" /> Provider actif
          </span>
        )}
      </div>
      {testResult && (
        <div className={`text-xs font-mono rounded-md px-3 py-2 ${testResult.ok ? 'bg-[color:var(--success)]/10 text-[var(--success)]' : 'bg-[color:var(--danger)]/10 text-[var(--danger)]'}`}>
          {testResult.message}
        </div>
      )}
      <div className="text-[10.5px] font-mono text-[var(--ink-faint)] italic leading-relaxed">
        ⚠️ Si Ollama tourne sur localhost, le navigateur peut bloquer la requête CORS.
        Lancez Ollama avec <code className="text-[var(--ink-muted)]">OLLAMA_ORIGINS=* ollama serve</code>.
      </div>
    </div>
  );
}

function OpenRouterTab({ settings, isActive, onChange, onUse }: {
  settings: ProviderSettings;
  isActive: boolean;
  onChange: (p: Partial<ProviderSettings>) => void;
  onUse: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<Array<{ id: string; name?: string; context_length?: number; pricing?: { prompt: string; completion: string } }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const apiKey = settings.apiKey || '';
  const model = settings.model || '';

  const fetchModels = async () => {
    setLoading(true);
    setError(null);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiKey && !models) fetchModels();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">OpenRouter</a> donne accès à de nombreux modèles via une seule clé API. Plusieurs modèles sont gratuits (suffixe <code className="font-mono text-[var(--ink)] bg-[var(--surface)] px-1 rounded">:free</code>).
      </div>
      <Field label="Clé API OpenRouter">
        <input type="password" value={apiKey}
          onChange={(e) => onChange({ apiKey: e.target.value })}
          placeholder="sk-or-v1-…"
          className="w-full h-9 px-3 rounded-md bg-[var(--surface)] border border-[var(--border)] text-sm font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]" />
        <div className="text-[10.5px] font-mono text-[var(--ink-faint)] mt-1">
          Stockée localement uniquement. Obtenez la vôtre sur openrouter.ai/keys
        </div>
      </Field>
      <Field label={`Modèles gratuits ${models ? `(${filtered.length}/${models.length})` : ''}`}>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input type="text" value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrer (ex: llama, mistral, gemma…)"
              className="flex-1 h-8 px-2 rounded border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]" />
            <button onClick={fetchModels} disabled={loading}
              className="text-xs font-medium px-3 rounded border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--ink-muted)] disabled:opacity-50">
              {loading ? '…' : models ? 'Recharger' : 'Charger la liste'}
            </button>
          </div>
          {error && (
            <div className="text-xs font-mono rounded-md px-3 py-2 bg-[color:var(--danger)]/10 text-[var(--danger)]">
              {error}
            </div>
          )}
          {models && (
            <div className="rounded-md border border-[var(--border)] divide-y divide-[var(--border)] max-h-72 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="text-center text-xs text-[var(--ink-faint)] py-4 italic">
                  Aucun modèle ne correspond à « {filter} »
                </div>
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
        </div>
      </Field>
      <div className="flex items-center gap-2">
        {!isActive ? (
          <button onClick={onUse} disabled={!apiKey || !model}
            className="text-xs font-medium px-3 py-1.5 rounded bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
            Utiliser OpenRouter
          </button>
        ) : (
          <span className="text-xs font-mono text-[var(--success)] flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[var(--success)]" /> Provider actif · {model}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main SettingsPanel ────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [tab, setTab] = useState<'claude' | 'ollama' | 'openrouter'>(settings.provider || 'claude');

  useEffect(() => { saveSettings(settings); }, [settings]);

  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));
  const updateProvider = (prov: 'ollama' | 'openrouter', patch: Partial<ProviderSettings>) =>
    setSettings((s) => ({ ...s, [prov]: { ...(s[prov] || {}), ...patch } }));

  const tabs: ['claude' | 'ollama' | 'openrouter', string][] = [
    ['claude', 'Claude (intégré)'],
    ['ollama', 'Ollama (local)'],
    ['openrouter', 'OpenRouter'],
  ];

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg)] rounded-lg border border-[var(--border)] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon.Settings className="size-4 text-[var(--accent)]" />
            <h3 className="text-sm font-medium text-[var(--ink)]">Paramètres</h3>
          </div>
          <button onClick={onClose}
            className="size-8 grid place-items-center rounded-md text-[var(--ink-faint)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]">
            <Icon.X className="size-4" />
          </button>
        </div>

        <div className="border-b border-[var(--border)] px-5 flex gap-0.5">
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`relative px-3 py-2.5 text-xs font-medium ${tab === k ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'}`}>
              {l}
              {settings.provider === k && (
                <span className="ml-1.5 text-[9px] font-mono px-1 py-0.5 rounded bg-[color:var(--success)]/15 text-[var(--success)]">actif</span>
              )}
              {tab === k && <span className="absolute bottom-0 left-2 right-2 h-px bg-[var(--accent)]" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'claude' && (
            <ClaudeTab active={settings.provider === 'claude' || !settings.provider}
              onUse={() => update({ provider: 'claude' })} />
          )}
          {tab === 'ollama' && (
            <OllamaTab settings={settings.ollama || {}}
              isActive={settings.provider === 'ollama'}
              onChange={(p) => updateProvider('ollama', p)}
              onUse={() => update({ provider: 'ollama' })} />
          )}
          {tab === 'openrouter' && (
            <OpenRouterTab settings={settings.openrouter || {}}
              isActive={settings.provider === 'openrouter'}
              onChange={(p) => updateProvider('openrouter', p)}
              onUse={() => update({ provider: 'openrouter' })} />
          )}
        </div>

        <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between text-[11px] font-mono text-[var(--ink-faint)]">
          <span>Les paramètres sont stockés localement (localStorage)</span>
          <button onClick={onClose}
            className="text-xs font-mono px-3 py-1.5 rounded bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
