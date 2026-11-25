// All data lives in this browser only (localStorage). Nothing is sent to any server
// except the AI provider you choose, and only when you start an AI session.
const KEY = 'english-ai-coach:v1';

const DEFAULTS = {
  settings: {
    provider: 'anthropic',
    keys: { anthropic: '', openai: '', gemini: '' },
    models: {
      anthropic: 'claude-sonnet-5-5',
      openai: 'gpt-4.1-mini',
      gemini: 'gemini-2.5-flash',
    },
    openaiBaseUrl: 'https://api.openai.com/v1',
    voice: '',
    rate: 0.9,
    autoSpeak: true,
    helpLanguage: '', // e.g. "Arabic" -> short rule explanations also in Arabic
  },
  progress: {},   // { lessonId: { grammar: true, listening: true, writing: true, speaking: true, grammarScore: 80 } }
  mistakes: [],   // [{ wrong, right, rule, lessonId, source, date }]
  days: [],       // ['2026-11-25', ...] days with at least one finished session
  drafts: {},     // { lessonId: 'writing draft' }
};

function merge(base, extra) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return extra ?? base;
  const out = { ...base };
  for (const k of Object.keys(extra || {})) {
    out[k] = (k in base && typeof base[k] === 'object' && !Array.isArray(base[k]) && base[k] !== null)
      ? merge(base[k], extra[k])
      : extra[k];
  }
  return out;
}

let state;
try {
  const raw = localStorage.getItem(KEY);
  state = merge(structuredClone(DEFAULTS), raw ? JSON.parse(raw) : {});
} catch {
  state = structuredClone(DEFAULTS);
}

export function getState() { return state; }

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage blocked: keep working in memory */ }
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function markDone(lessonId, session, extra = {}) {
  const p = state.progress[lessonId] || (state.progress[lessonId] = {});
  p[session] = true;
  Object.assign(p, extra);
  if (!state.days.includes(today())) state.days.push(today());
  save();
}

export function addMistakes(list, lessonId, source) {
  const date = today();
  for (const m of list) {
    const dup = state.mistakes.some(x => x.wrong === m.wrong && x.right === m.right);
    if (!dup) state.mistakes.unshift({ ...m, lessonId, source, date });
  }
  state.mistakes = state.mistakes.slice(0, 500);
  save();
}

export function streak() {
  const set = new Set(state.days);
  let count = 0;
  const d = new Date();
  // A streak is still alive if you practised yesterday but not yet today.
  if (!set.has(fmt(d))) d.setDate(d.getDate() - 1);
  while (set.has(fmt(d))) { count++; d.setDate(d.getDate() - 1); }
  return count;
}
function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function exportData() {
  const copy = structuredClone(state);
  copy.settings.keys = { anthropic: '', openai: '', gemini: '' }; // never export keys
  return JSON.stringify(copy, null, 2);
}

export function importData(json) {
  const data = JSON.parse(json);
  const keys = state.settings.keys;
  state = merge(structuredClone(DEFAULTS), data);
  state.settings.keys = keys;
  save();
}

export function resetAll() {
  state = structuredClone(DEFAULTS);
  save();
}
