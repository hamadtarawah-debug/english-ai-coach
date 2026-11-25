import { speak } from './speech.js';

export function esc(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Create an element from an HTML string. */
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Tiny, safe markdown: escapes everything first, then adds a few formats. */
export function md(text = '') {
  const lines = esc(text).split('\n');
  let html = '';
  let inList = false;
  const inline = s => s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
  for (const line of lines) {
    const fix = line.match(/^\s*(?:[-*]\s*)?FIX:\s*(.+?)\s*=&gt;\s*(.+?)(?:\s*\|\s*(.+))?$/);
    if (inList && !/^\s*[-*]\s+/.test(line)) { html += '</ul>'; inList = false; }
    if (fix) {
      html += `<span class="fix"><span class="wrong">${fix[1]}</span> → <span class="right">${fix[2]}</span>${fix[3] ? `<span class="rule">${inline(fix[3])}</span>` : ''}</span>`;
    } else if (/^#{1,4}\s+/.test(line)) {
      html += `<h3>${inline(line.replace(/^#{1,4}\s+/, ''))}</h3>`;
    } else if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`;
    } else if (line.trim() === '') {
      html += '';
    } else {
      html += `<p>${inline(line)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

/** Read "FIX: wrong => right | rule" lines from an AI answer. */
export function parseFixes(text = '') {
  const out = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(?:[-*]\s*)?FIX:\s*(.+?)\s*=>\s*(.+?)(?:\s*\|\s*(.+))?$/);
    if (m) out.push({ wrong: clean(m[1]), right: clean(m[2]), rule: clean(m[3] || '') });
  }
  return out;
}
const clean = s => s.replace(/^["“”']+|["“”']+$/g, '').replace(/\*\*/g, '').trim();

export function sayButton(text) {
  const b = el(`<button class="say" title="Listen" aria-label="Listen">🔊</button>`);
  b.addEventListener('click', () => speak(text));
  return b;
}

export function showError(container, err) {
  container.innerHTML = `<div class="error">${esc(err.message || String(err))}</div>`;
}

export async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) { const old = btn.textContent; btn.textContent = 'Copied ✓'; setTimeout(() => (btn.textContent = old), 1500); }
  } catch {
    window.prompt('Copy this text:', text);
  }
}

// ---------- answer checking ----------
const CONTRACTIONS = [
  [/\bi'm\b/g, 'i am'], [/\byou're\b/g, 'you are'], [/\bwe're\b/g, 'we are'], [/\bthey're\b/g, 'they are'],
  [/\b(he|she|it|that|what|where|who|there|here)'s\b/g, '$1 is'],
  [/\bisn't\b/g, 'is not'], [/\baren't\b/g, 'are not'], [/\bwasn't\b/g, 'was not'], [/\bweren't\b/g, 'were not'],
  [/\bdon't\b/g, 'do not'], [/\bdoesn't\b/g, 'does not'], [/\bdidn't\b/g, 'did not'],
  [/\bcan't\b/g, 'cannot'], [/\bcan not\b/g, 'cannot'], [/\bwon't\b/g, 'will not'],
  [/\bhaven't\b/g, 'have not'], [/\bhasn't\b/g, 'has not'],
  [/\b(i|you|we|they)'ve\b/g, '$1 have'], [/\b(i|you|he|she|it|we|they)'ll\b/g, '$1 will'],
];
export function normalize(s = '') {
  let t = String(s).toLowerCase().replace(/[’‘`]/g, "'").replace(/[“”]/g, '"');
  for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep);
  return t.replace(/[.,!?;:"]/g, '').replace(/\s+/g, ' ').trim();
}
export function isCorrect(given, answers) {
  const list = Array.isArray(answers) ? answers : [answers];
  const g = normalize(given);
  return g.length > 0 && list.some(a => normalize(a) === g);
}

/**
 * Render a list of exercises with a "Check" button.
 * Types: choice | fill | fix | order
 */
export function renderExercises(container, exercises, { onChecked } = {}) {
  container.innerHTML = '';
  const items = exercises.map((ex, i) => {
    const node = el(`<div class="ex"><div class="q"><b>${i + 1}.</b></div><div class="a"></div><div class="feedback"></div></div>`);
    const q = node.querySelector('.q');
    const a = node.querySelector('.a');
    const label = {
      fix: 'Correct the mistake: ',
      order: 'Put the words in order: ',
    }[ex.type] || '';
    q.insertAdjacentHTML('beforeend', `${label ? `<span class="muted small">${label}</span>` : ''}${esc(ex.q)}`);
    let getValue;
    if (ex.type === 'choice') {
      let picked = '';
      const box = el('<div class="choices"></div>');
      for (const opt of ex.options || []) {
        const b = el(`<button class="choice">${esc(opt)}</button>`);
        b.addEventListener('click', () => {
          picked = opt;
          box.querySelectorAll('.choice').forEach(c => c.classList.remove('picked'));
          b.classList.add('picked');
        });
        box.append(b);
      }
      a.append(box);
      getValue = () => picked;
    } else {
      const input = el(`<input type="text" autocomplete="off" spellcheck="false" placeholder="${ex.type === 'fill' ? 'missing words' : 'write the full sentence'}">`);
      a.append(input);
      getValue = () => input.value;
    }
    container.append(node);
    return { ex, node, getValue };
  });

  const bar = el(`<div class="row between" style="margin-top:14px"><span class="score"></span><button class="btn">Check answers</button></div>`);
  container.append(bar);
  bar.querySelector('button').addEventListener('click', () => {
    let right = 0;
    for (const it of items) {
      const val = it.getValue();
      const ok = isCorrect(val, it.ex.answer);
      if (ok) right++;
      it.node.classList.toggle('correct', ok);
      it.node.classList.toggle('incorrect', !ok);
      const fb = it.node.querySelector('.feedback');
      const ans = [].concat(it.ex.answer)[0];
      fb.className = `feedback ${ok ? 'good' : 'bad'}`;
      fb.innerHTML = ok ? '✓ Correct' : `✗ Answer: <b>${esc(ans)}</b>${it.ex.why ? ` — ${esc(it.ex.why)}` : ''}`;
    }
    const pct = Math.round((right / items.length) * 100);
    bar.querySelector('.score').textContent = `${right} / ${items.length} (${pct}%)`;
    onChecked?.({ right, total: items.length, pct, wrong: items.filter(it => !isCorrect(it.getValue(), it.ex.answer)) });
  });
}
