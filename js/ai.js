// One small function talks to Claude, ChatGPT (or any OpenAI-compatible API) and Gemini.
// The request goes straight from your browser to the provider with YOUR key.
import { getState } from './store.js';

export const PROVIDERS = {
  anthropic: {
    name: 'Claude (Anthropic)',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'sk-ant-…',
  },
  openai: {
    name: 'ChatGPT (OpenAI or compatible)',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-…',
  },
  gemini: {
    name: 'Gemini (Google)',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyHint: 'AIza…',
  },
};

export class AIError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function hasKey() {
  const s = getState().settings;
  return Boolean(s.keys[s.provider]);
}

export function providerName() {
  return PROVIDERS[getState().settings.provider].name;
}

/**
 * @param {object} opts
 * @param {string} opts.system   system prompt
 * @param {{role:'user'|'assistant', content:string}[]} opts.messages  must start with a user message
 * @param {number} [opts.maxTokens]
 * @returns {Promise<string>} the model's text reply
 */
export async function chat({ system, messages, maxTokens = 1500 }) {
  const s = getState().settings;
  const provider = s.provider;
  const key = s.keys[provider];
  const model = s.models[provider];
  if (!key) throw new AIError('NO_KEY', 'Add your API key in Settings first (or use “Copy prompt” to practise in the free chat app).');
  if (!messages.length || messages[0].role !== 'user') {
    messages = [{ role: 'user', content: 'Start.' }, ...messages];
  }

  let res;
  try {
    if (provider === 'anthropic') {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
      });
    } else if (provider === 'openai') {
      const base = (s.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
      res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          max_completion_tokens: maxTokens,
          messages: [{ role: 'system', content: system }, ...messages],
        }),
      });
    } else if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
          // Newer Gemini models "think" first and that counts against the limit, so give extra room.
          generationConfig: { maxOutputTokens: maxTokens + 4096 },
        }),
      });
    } else {
      throw new AIError('BAD_PROVIDER', `Unknown provider: ${provider}`);
    }
  } catch (e) {
    if (e instanceof AIError) throw e;
    throw new AIError('NETWORK', `Could not reach ${PROVIDERS[provider].name}. Check your internet connection. (${e.message})`);
  }

  const raw = await res.text();
  let data = null;
  try { data = JSON.parse(raw); } catch { /* not JSON */ }

  if (!res.ok) {
    const msg = data?.error?.message || data?.error?.status || raw.slice(0, 300) || res.statusText;
    if (res.status === 401 || res.status === 403) throw new AIError('AUTH', `The API key was rejected (${res.status}). Check it in Settings. Details: ${msg}`);
    if (res.status === 404) throw new AIError('MODEL', `Model “${model}” was not found (404). Change the model name in Settings. Details: ${msg}`);
    if (res.status === 429) throw new AIError('RATE', `Too many requests or no credit left (429). Wait a moment or check your plan. Details: ${msg}`);
    throw new AIError('HTTP', `${PROVIDERS[provider].name} error ${res.status}: ${msg}`);
  }

  let text = '';
  if (provider === 'anthropic') text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  else if (provider === 'openai') text = data.choices?.[0]?.message?.content || '';
  else text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');

  if (!text.trim()) throw new AIError('EMPTY', 'The AI returned an empty answer. Please try again.');
  return text.trim();
}

/** Pull the first JSON object/array out of a model reply (handles ```json fences and extra words). */
export function extractJSON(text) {
  const cleaned = text.replace(/```(?:json)?/gi, '');
  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (start === -1 || end <= start) throw new AIError('JSON', 'The AI answer was not in the expected format. Please try again.');
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new AIError('JSON', 'The AI answer was not valid JSON. Please try again.');
  }
}
