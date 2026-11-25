import { getState, save, streak, exportData, importData, resetAll } from './store.js';
import { PROVIDERS, chat, hasKey, providerName, extractJSON } from './ai.js';
import { englishVoices, speak, stopSpeaking } from './speech.js';
import { el, esc, $, $$, showError, renderExercises } from './ui.js';
import { grammarView, listeningView, writingView, speakingView } from './sessions.js';
import * as P from './prompts.js';

const app = document.getElementById('app');
const SESSIONS = [
  { id: 'grammar', label: 'Grammar', icon: '📘', view: grammarView },
  { id: 'listening', label: 'Listening', icon: '🎧', view: listeningView },
  { id: 'writing', label: 'Writing', icon: '✍️', view: writingView },
  { id: 'speaking', label: 'Speaking', icon: '🗣️', view: speakingView },
];

let index = null;
const lessonCache = {};

async function loadIndex() {
  if (index) return index;
  const res = await fetch('lessons/index.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('Could not load lessons/index.json');
  index = await res.json();
  return index;
}
async function loadLesson(id) {
  if (lessonCache[id]) return lessonCache[id];
  const meta = (await loadIndex()).lessons.find(l => l.id === id);
  if (!meta) throw new Error(`Lesson “${id}” not found.`);
  const res = await fetch(`lessons/${meta.file}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load lessons/${meta.file}`);
  return (lessonCache[id] = await res.json());
}

const doneCount = id => SESSIONS.filter(s => getState().progress[id]?.[s.id]).length;

// ================= HOME =================
async function home() {
  const { lessons, levels } = await loadIndex();
  const next = lessons.find(l => doneCount(l.id) < 4) || lessons[lessons.length - 1];
  const totalDone = lessons.filter(l => doneCount(l.id) === 4).length;
  app.innerHTML = '';

  if (!hasKey()) {
    app.append(el(`<div class="banner small">👋 <b>Start here:</b> grammar exercises and listening work without any key.
      For AI writing correction and speaking practice, <a href="#/settings">connect Claude, ChatGPT or Gemini</a> — or use “Copy prompt” in any session to practise in the free chat app.</div>`));
  }

  app.append(el(`<div class="card hero">
    <p class="muted small" style="margin:0">TODAY'S LESSON · ${esc(next.level)}</p>
    <h1 style="margin:.2em 0 .3em">${esc(next.title)}</h1>
    <p class="muted">${esc(next.goal)}</p>
    <div class="row" style="margin-top:14px">
      <a class="btn" href="#/lesson/${next.id}/${SESSIONS.find(s => !getState().progress[next.id]?.[s.id])?.id || 'grammar'}">${doneCount(next.id) ? 'Continue' : 'Start'} →</a>
    </div>
    <div class="stats">
      <div class="stat"><b>${streak()}🔥</b><span class="small">day streak</span></div>
      <div class="stat"><b>${totalDone}/${lessons.length}</b><span class="small">lessons finished</span></div>
      <div class="stat"><b>${getState().mistakes.length}</b><span class="small">mistakes to review</span></div>
    </div>
  </div>`));

  app.append(el(`<div class="card soft small"><b>How it works:</b> every lesson has 4 sessions —
    📘 grammar rule + exercises, 🎧 listening dialogue + questions + dictation, ✍️ writing corrected by AI, 🗣️ speaking role-play with AI (use your microphone).
    Finish all 4, then move to the next lesson. One lesson a day is perfect.</div>`));

  for (const lvl of levels) {
    const list = lessons.filter(l => l.level === lvl.id);
    const sec = el(`<section style="margin-top:24px"><h2>${esc(lvl.id)} — ${esc(lvl.name)}</h2><p class="muted small">${esc(lvl.description)}</p><div class="grid"></div></section>`);
    const grid = $('.grid', sec);
    if (!list.length) grid.append(el(`<div class="card soft muted small">Lessons coming soon — new lessons are added every day. <a href="https://github.com/hamadtarawah-debug/english-ai-coach/blob/main/docs/ROADMAP.md" target="_blank" rel="noopener">See the plan</a>.</div>`));
    list.forEach(l => {
      const p = getState().progress[l.id] || {};
      grid.append(el(`<a class="card lesson-card" href="#/lesson/${l.id}/grammar">
        <div class="num">LESSON ${l.order}</div>
        <h3 style="margin:.2em 0">${esc(l.title)}</h3>
        <div class="muted small">${esc(l.goal)}</div>
        <div class="dots">${SESSIONS.map(s => `<span class="dot ${p[s.id] ? 'done' : ''}" title="${s.label}">${s.icon}${p[s.id] ? '✓' : ''}</span>`).join('')}</div>
      </a>`));
    });
    app.append(sec);
  }
}

// ================= LESSON =================
async function lessonPage(id, tab = 'grammar') {
  const lesson = await loadLesson(id);
  const { lessons } = await loadIndex();
  const i = lessons.findIndex(l => l.id === id);
  const nextLesson = lessons[i + 1];
  const p = getState().progress[id] || {};
  const session = SESSIONS.find(s => s.id === tab) || SESSIONS[0];
  app.innerHTML = '';
  app.append(el(`<div>
    <a href="#/" class="muted small" style="text-decoration:none">← All lessons</a>
    <p class="muted small" style="margin:.6em 0 0">${esc(lesson.level)} · Lesson ${lesson.order}</p>
    <h1>${esc(lesson.title)}</h1>
    <nav class="tabs">${SESSIONS.map(s => `<a class="tab ${s.id === session.id ? 'active' : ''}" href="#/lesson/${id}/${s.id}">${s.icon} ${s.label} ${p[s.id] ? '<span class="ok">✓</span>' : ''}</a>`).join('')}</nav>
  </div>`));
  const body = el('<div></div>');
  app.append(body);
  session.view(lesson, body);

  const idx = SESSIONS.indexOf(session);
  const nav = el('<div class="row between" style="margin-top:20px"></div>');
  nav.append(idx > 0 ? el(`<a class="btn secondary" href="#/lesson/${id}/${SESSIONS[idx - 1].id}">← ${SESSIONS[idx - 1].label}</a>`) : el('<span></span>'));
  if (idx < SESSIONS.length - 1) nav.append(el(`<a class="btn" href="#/lesson/${id}/${SESSIONS[idx + 1].id}">Next: ${SESSIONS[idx + 1].label} →</a>`));
  else if (nextLesson) nav.append(el(`<a class="btn" href="#/lesson/${nextLesson.id}/grammar">Next lesson →</a>`));
  app.append(nav);
}

// ================= MISTAKES =================
async function mistakesPage() {
  const s = getState();
  app.innerHTML = '';
  app.append(el(`<div><h1>My mistakes</h1>
    <p class="muted">Every grammar mistake from your writing, speaking and exercises is saved here. Review them — they are your personal grammar book.</p></div>`));
  if (!s.mistakes.length) {
    app.append(el('<div class="card soft muted">No mistakes saved yet. Do a writing or speaking session and they will appear here.</div>'));
    return;
  }
  const practice = el(`<div class="card"><div class="row between"><h3 style="margin:0">🤖 Practise my mistakes</h3>
    <button class="btn small">Make exercises from my last mistakes</button></div><div class="box" style="margin-top:12px"></div></div>`);
  app.append(practice);
  $('button', practice).addEventListener('click', async e => {
    const box = $('.box', practice);
    const btn = e.currentTarget;
    btn.disabled = true;
    box.innerHTML = '<p class="thinking">Creating exercises from your mistakes</p>';
    try {
      const recent = s.mistakes.slice(0, 12);
      const lessonId = recent[0].lessonId;
      const lesson = await loadLesson(lessonId).catch(async () => loadLesson((await loadIndex()).lessons[0].id));
      const { system, user } = P.moreExercises(lesson, recent);
      const data = extractJSON(await chat({ system, messages: [{ role: 'user', content: user }], maxTokens: 2500 }));
      renderExercises(box, (data.exercises || []).filter(x => x.q && x.answer));
    } catch (err) { showError(box, err); }
    btn.disabled = false;
  });

  const list = el('<div class="card"></div>');
  s.mistakes.forEach((m, i) => {
    const row = el(`<div class="mistake row between" style="align-items:flex-start">
      <div><span class="wrong">${esc(m.wrong)}</span> → <span class="right">${esc(m.right)}</span>
      ${m.rule ? `<div class="muted small">${esc(m.rule)}</div>` : ''}
      <div class="muted small">${esc(m.source || '')} · ${esc(m.date || '')}</div></div>
      <button class="btn ghost small" title="I learned this">✓ Learned</button></div>`);
    $('button', row).addEventListener('click', () => { s.mistakes.splice(s.mistakes.indexOf(m), 1); save(); row.remove(); });
    list.append(row);
  });
  app.append(list);
}

// ================= SETTINGS =================
function settingsPage() {
  const s = getState().settings;
  app.innerHTML = '';
  const form = el(`<div>
    <h1>Settings</h1>
    <div class="card">
      <h2>1. Choose your AI</h2>
      <div class="radio-row field">${Object.entries(PROVIDERS).map(([id, p]) => `
        <label><input type="radio" name="provider" value="${id}" ${s.provider === id ? 'checked' : ''}><span>${esc(p.name)}</span></label>`).join('')}</div>
      ${Object.entries(PROVIDERS).map(([id, p]) => `
        <div class="prov" data-prov="${id}">
          <div class="field"><label>API key</label>
            <input type="password" data-key="${id}" value="${esc(s.keys[id])}" placeholder="${esc(p.keyHint)}" autocomplete="off">
            <p class="muted small">Get a key: <a href="${p.keyUrl}" target="_blank" rel="noopener">${esc(p.keyUrl.replace('https://', ''))}</a></p></div>
          <div class="field"><label>Model</label><input type="text" data-model="${id}" value="${esc(s.models[id])}">
            <p class="muted small">You can change this to any model your key can use.</p></div>
          ${id === 'openai' ? `<div class="field"><label>API base URL (optional)</label><input type="url" data-base value="${esc(s.openaiBaseUrl)}">
            <p class="muted small">Any OpenAI-compatible service works (Groq, OpenRouter, a local server…).</p></div>` : ''}
        </div>`).join('')}
      <div class="row"><button class="btn test">Test connection</button><span class="test-out small"></span></div>
      <p class="muted small" style="margin-top:12px">🔒 Your key is saved only in this browser and is sent only to the AI company you chose. Do not use this on a shared computer. Tip: set a monthly spending limit on your key.</p>
    </div>

    <div class="card">
      <h2>2. Voice</h2>
      <div class="field"><label>English voice</label><select class="voice"></select></div>
      <div class="field"><label>Speed: <span class="rate-v">${s.rate}</span>×</label><input type="range" class="rate" min="0.5" max="1.2" step="0.05" value="${s.rate}" style="width:100%"></div>
      <button class="btn secondary small try">🔊 Try voice</button>
    </div>

    <div class="card">
      <h2>3. Help in my language</h2>
      <div class="field"><label>Explain grammar rules also in (optional)</label>
        <input type="text" class="help" placeholder="e.g. Arabic" value="${esc(s.helpLanguage)}">
        <p class="muted small">Leave empty for English only (best for practice). If you write a language, the AI adds one short line in it when it explains a rule.</p></div>
    </div>

    <div class="card">
      <h2>4. My data</h2>
      <p class="muted small">Progress is saved in this browser. Export it to move to another device (keys are not exported).</p>
      <div class="row"><button class="btn secondary small exp">⬇ Export progress</button>
        <label class="btn secondary small" style="margin:0">⬆ Import<input type="file" accept="application/json" class="imp hidden"></label>
        <button class="btn danger small reset">Reset everything</button></div>
    </div>
  </div>`);
  app.append(form);

  const showProv = () => $$('.prov', form).forEach(d => d.classList.toggle('hidden', d.dataset.prov !== s.provider));
  showProv();
  $$('input[name=provider]', form).forEach(r => r.addEventListener('change', () => { s.provider = r.value; save(); showProv(); }));
  $$('[data-key]', form).forEach(i => i.addEventListener('input', () => { s.keys[i.dataset.key] = i.value.trim(); save(); }));
  $$('[data-model]', form).forEach(i => i.addEventListener('input', () => { s.models[i.dataset.model] = i.value.trim(); save(); }));
  $('[data-base]', form).addEventListener('input', e => { s.openaiBaseUrl = e.target.value.trim(); save(); });

  $('.test', form).addEventListener('click', async () => {
    const out = $('.test-out', form);
    out.textContent = 'Testing…';
    out.className = 'test-out small';
    try {
      const r = await chat({ system: 'You are a test. Reply with one short friendly English sentence.', messages: [{ role: 'user', content: 'Say hello to an English learner.' }], maxTokens: 60 });
      out.textContent = `✓ ${providerName()} works: “${r}”`;
      out.style.color = 'var(--good)';
    } catch (err) {
      out.textContent = err.message;
      out.style.color = 'var(--bad)';
    }
  });

  const voiceSel = $('.voice', form);
  const fillVoices = () => {
    const vs = englishVoices();
    voiceSel.innerHTML = vs.length
      ? vs.map(v => `<option value="${esc(v.name)}" ${v.name === s.voice ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')
      : '<option value="">Default voice</option>';
  };
  fillVoices();
  window.speechSynthesis?.addEventListener?.('voiceschanged', fillVoices);
  voiceSel.addEventListener('change', () => { s.voice = voiceSel.value; save(); });
  $('.rate', form).addEventListener('input', e => { s.rate = Number(e.target.value); $('.rate-v', form).textContent = s.rate; save(); });
  $('.try', form).addEventListener('click', () => { stopSpeaking(); speak('Hello! I am your English coach. Are you ready for today\'s lesson?'); });
  $('.help', form).addEventListener('input', e => { s.helpLanguage = e.target.value.trim(); save(); });

  $('.exp', form).addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportData()], { type: 'application/json' }));
    a.download = 'english-ai-coach-progress.json';
    a.click();
  });
  $('.imp', form).addEventListener('change', async e => {
    try { importData(await e.target.files[0].text()); alertBox('Progress imported ✓'); } catch { alertBox('That file is not a valid progress file.'); }
  });
  $('.reset', form).addEventListener('click', e => {
    if (e.currentTarget.dataset.sure) { resetAll(); route(); return; }
    e.currentTarget.dataset.sure = '1';
    e.currentTarget.textContent = 'Click again to delete all progress';
  });
}
function alertBox(msg) {
  const b = el(`<div class="banner small" style="position:fixed;bottom:16px;left:16px;right:16px;max-width:420px;margin:auto;z-index:20">${esc(msg)}</div>`);
  document.body.append(b);
  setTimeout(() => b.remove(), 2500);
}

// ================= ROUTER =================
async function route() {
  stopSpeaking();
  const [, page, a, b] = location.hash.replace(/^#/, '').split('/');
  $$('.nav a').forEach(n => n.classList.toggle('active', n.dataset.nav === (page || 'home')));
  try {
    if (page === 'lesson' && a) await lessonPage(decodeURIComponent(a), b);
    else if (page === 'mistakes') await mistakesPage();
    else if (page === 'settings') settingsPage();
    else await home();
  } catch (err) {
    app.innerHTML = '';
    const box = el('<div></div>');
    app.append(box);
    showError(box, err);
    if (location.protocol === 'file:') {
      app.append(el('<p class="muted small">Tip: open the site through a local server (for example <code>python3 -m http.server</code>) or the GitHub Pages link — browsers block loading lessons from file://.</p>'));
    }
  }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
route();
