// AI provider abstraction — settings storage + aiCall / aiCallMultimodal dispatch.
// 4 providers: Claude (Anthropic), OpenAI, OpenRouter, Ollama (local).

// ── Types & storage ───────────────────────────────────────────────────────────

export const SETTINGS_KEY = 'genealogor.aiSettings';

export type ProviderId = 'claude' | 'openai' | 'openrouter' | 'ollama';

export interface ProviderSettings {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}

export interface Settings {
  provider?: ProviderId;
  claude?: ProviderSettings;
  openai?: ProviderSettings;
  openrouter?: ProviderSettings;
  ollama?: ProviderSettings;
}

export function loadSettings(): Settings {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as Settings;
  } catch { return {}; }
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function getActive(): ({ provider: string } & ProviderSettings) | null {
  const s = loadSettings();
  if (!s.provider) return null;
  const ps = s[s.provider as ProviderId] || {};
  return { provider: s.provider, ...ps };
}

// ── Exported AI dispatch ──────────────────────────────────────────────────────

export async function aiCall(prompt: string): Promise<string> {
  const active = getActive();
  const provider = active?.provider || 'claude';

  if (provider === 'claude') {
    if (!active?.apiKey) throw new Error('Clé API Anthropic manquante — configurez-la dans les Paramètres.');
    const model = active?.model || 'claude-haiku-4-5-20251001';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': active.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json() as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text || '';
  }

  if (provider === 'openai') {
    if (!active?.apiKey) throw new Error('Clé API OpenAI manquante — configurez-la dans les Paramètres.');
    const model = active?.model || 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${active.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || '';
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

  throw new Error(`Provider '${provider}' non disponible. Configurez un provider dans les Paramètres.`);
}

export async function aiCallMultimodal(opts: { prompt: string; image?: string; mimeType?: string }): Promise<string> {
  const { prompt, image, mimeType } = opts;
  if (!image) return aiCall(prompt);
  const active = getActive();
  const provider = active?.provider || 'claude';

  const b64 = image.includes(',') ? image.split(',')[1] : image;
  const dataUrl = image.startsWith('data:') ? image : `data:${mimeType || 'image/jpeg'};base64,${b64}`;
  const resolvedMime = (mimeType || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  if (provider === 'claude') {
    if (!active?.apiKey) throw new Error('Clé API Anthropic manquante — configurez-la dans les Paramètres.');
    const model = active?.model || 'claude-haiku-4-5-20251001';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': active.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: resolvedMime, data: b64 } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json() as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text || '';
  }

  if (provider === 'openai') {
    if (!active?.apiKey) throw new Error('Clé API OpenAI manquante — configurez-la dans les Paramètres.');
    const model = active?.model || 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${active.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || '';
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
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: prompt },
          ],
        }],
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
