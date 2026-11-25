// The four sessions of every lesson: Grammar, Listening, Writing, Speaking.
import { chat, extractJSON, hasKey, providerName } from './ai.js';
import * as P from './prompts.js';
import { speak, stopSpeaking, listen, canListen, canSpeak, dialogueVoices } from './speech.js';
import { getState, save, markDone, addMistakes } from './store.js';
import { el, esc, md, parseFixes, renderExercises, sayButton, showError, copyText, normalize } from './ui.js';

function aiBlock(kind, lesson) {
  // Shown on AI features: either "connected to X" or a copy-prompt fallback.
  const box = el(`<div class="card soft small">
    ${hasKey()
      ? `<span class="pill">Using ${esc(providerName())}</span>`
      : `<b>No API key yet.</b> You can still practise for free: copy this prompt and paste it into the Claude, ChatGPT or Gemini app (voice mode works great for speaking and listening). Or <a href="#/settings">add a key</a> to practise right here.`}
    <div class="row" style="margin-top:8px"><button class="btn secondary small">📋 Copy prompt for chat app</button></div>
  </div>`);
  box.querySelector('button').addEventListener('click', e => copyText(P.chatAppPrompt(kind, lesson), e.currentTarget));
  return box;
}

// ================= GRAMMAR =================
export function grammarView(lesson, root) {
  const g = lesson.grammar;
  root.append(el(`<div class="card">
    <h2>📘 ${esc(lesson.title)}</h2>
    <p class="muted">${esc(lesson.goal)}</p>
    <div class="ai-out">${g.explanation.map(p => md(p)).join('')}</div>
  </div>`));

  if (g.table) {
    root.append(el(`<div class="card"><h3>Form</h3><div class="table-wrap"><table>
      <thead><tr>${g.table.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${g.table.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div></div>`));
  }

  const exCard = el(`<div class="card"><h3>Examples <span class="muted small">— tap 🔊 to listen</span></h3><div class="list"></div></div>`);
  for (const ex of g.examples) {
    const row = el(`<div class="example"><div><div>${esc(ex.en)}</div>${ex.note ? `<div class="note">${esc(ex.note)}</div>` : ''}</div></div>`);
    row.prepend(sayButton(ex.en));
    exCard.querySelector('.list').append(row);
  }
  root.append(exCard);

  if (g.mistakes?.length) {
    root.append(el(`<div class="card"><h3>Common mistakes</h3>${g.mistakes.map(m => `
      <div class="mistake"><span class="wrong">${esc(m.wrong)}</span> → <span class="right">${esc(m.right)}</span>
      <div class="muted small">${esc(m.why)}</div></div>`).join('')}</div>`));
  }

  const practice = el(`<div class="card"><h3>Practice</h3><div class="ex-box"></div></div>`);
  root.append(practice);
  renderExercises(practice.querySelector('.ex-box'), lesson.exercises, {
    onChecked: ({ pct, wrong }) => {
      const prev = getState().progress[lesson.id]?.grammarScore || 0;
      if (pct >= 60) markDone(lesson.id, 'grammar', { grammarScore: Math.max(prev, pct) });
      // Save real wrong answers (not empty ones) to "My mistakes".
      const real = wrong.filter(w => w.ex.type !== 'choice' && w.getValue().trim());
      if (real.length) addMistakes(real.map(w => ({ wrong: w.getValue().trim(), right: [].concat(w.ex.answer)[0], rule: w.ex.q })), lesson.id, 'grammar');
    },
  });

  // AI: more exercises + ask the tutor
  const more = el(`<div class="card">
    <h3>🤖 More practice with AI</h3>
    <p class="muted small">New exercises every time — the AI writes them for this grammar point.</p>
    <button class="btn secondary">Generate 8 new exercises</button>
    <div class="gen" style="margin-top:12px"></div>
    <hr style="border:none;border-top:1px solid var(--border);margin:18px 0">
    <h3>Ask your teacher</h3>
    <div class="composer"><input type="text" placeholder="e.g. When do I use “is” and when “are”?"><button class="btn">Ask</button></div>
    <div class="answer ai-out" style="margin-top:12px"></div>
  </div>`);
  root.append(more);
  const gen = more.querySelector('.gen');
  more.querySelector('.btn.secondary').addEventListener('click', async e => {
    const btn = e.currentTarget;
    btn.disabled = true;
    gen.innerHTML = '<p class="thinking">Writing new exercises</p>';
    try {
      const { system, user } = P.moreExercises(lesson);
      const data = extractJSON(await chat({ system, messages: [{ role: 'user', content: user }], maxTokens: 2500 }));
      renderExercises(gen, (data.exercises || []).filter(x => x.q && x.answer));
    } catch (err) { showError(gen, err); }
    btn.disabled = false;
  });
  const askInput = more.querySelector('.composer input');
  const ans = more.querySelector('.answer');
  const ask = async () => {
    const q = askInput.value.trim();
    if (!q) return;
    ans.innerHTML = '<p class="thinking">Thinking</p>';
    try {
      ans.innerHTML = md(await chat({ system: P.tutorSystem(lesson), messages: [{ role: 'user', content: q }], maxTokens: 700 }));
    } catch (err) { showError(ans, err); }
  };
  more.querySelector('.composer .btn').addEventListener('click', ask);
  askInput.addEventListener('keydown', e => e.key === 'Enter' && ask());
}

// ================= LISTENING =================
export function listeningView(lesson, root) {
  const card = el(`<div class="card">
    <div class="row between"><h2 style="margin:0">🎧 Listening</h2>
      <button class="btn secondary small new-ai">✨ New AI dialogue</button></div>
    <p class="muted small" style="margin-top:6px">Listen first without reading. Answer the questions. Then open the transcript and listen again.</p>
    <div class="player"></div>
  </div>`);
  root.append(card);
  root.append(aiBlock('listening', lesson));
  if (!canSpeak) card.append(el('<p class="error">This browser cannot speak text. Try Chrome, Edge or Safari.</p>'));

  const player = card.querySelector('.player');
  const show = data => renderListening(player, data, lesson);
  show(lesson.listening);

  card.querySelector('.new-ai').addEventListener('click', async e => {
    const btn = e.currentTarget;
    btn.disabled = true;
    stopSpeaking();
    player.innerHTML = '<p class="thinking">Writing a new dialogue for you</p>';
    try {
      const { system, user } = P.listeningGenerate(lesson);
      const data = extractJSON(await chat({ system, messages: [{ role: 'user', content: user }], maxTokens: 2500 }));
      if (!Array.isArray(data.script) || !data.script.length) throw new Error('The AI did not return a dialogue. Try again.');
      data.questions = (data.questions || []).map(q => ({ ...q, answer: [].concat(q.answer) }));
      show(data);
    } catch (err) { showError(player, err); }
    btn.disabled = false;
  });
}

function renderListening(player, data, lesson) {
  stopSpeaking();
  const speakers = [...new Set(data.script.map(l => l.speaker))];
  const voices = dialogueVoices();
  const voiceOf = spk => voices[speakers.indexOf(spk) % 2];
  player.innerHTML = '';
  const ui = el(`<div class="stack">
    <h3 style="margin-top:12px">${esc(data.title || 'Dialogue')}</h3>
    <div class="row">
      <button class="btn play">▶ Play</button>
      <button class="btn secondary stop">■ Stop</button>
      <select class="speed" style="width:auto">
        <option value="0.7">Slow (0.7×)</option>
        <option value="0.85" selected>Learner (0.85×)</option>
        <option value="1">Natural (1×)</option>
      </select>
      <label style="display:flex;gap:6px;align-items:center;margin:0;font-weight:500"><input type="checkbox" class="show-t"> Show transcript</label>
    </div>
    <div class="script blurred"></div>
    <div class="qs"></div>
    <details class="dict"><summary>✍️ Dictation (listen and write)</summary><div class="dict-body" style="margin-top:10px"></div></details>
  </div>`);
  player.append(ui);
  const scriptBox = ui.querySelector('.script');
  const rate = () => Number(ui.querySelector('.speed').value);
  const lines = data.script.map((l, i) => {
    const n = el(`<div class="script-line"><span class="spk">${esc(l.speaker)}:</span><span class="txt">${esc(l.text)}</span></div>`);
    n.addEventListener('click', () => { stopSpeaking(); speak(l.text, { voiceName: voiceOf(l.speaker), rate: rate() }); });
    scriptBox.append(n);
    return n;
  });
  ui.querySelector('.show-t').addEventListener('change', e => scriptBox.classList.toggle('blurred', !e.target.checked));

  let playing = false;
  ui.querySelector('.play').addEventListener('click', async () => {
    if (playing) return;
    playing = true;
    stopSpeaking();
    for (let i = 0; i < data.script.length && playing; i++) {
      lines.forEach(n => n.classList.remove('playing'));
      lines[i].classList.add('playing');
      await speak(data.script[i].text, { voiceName: voiceOf(data.script[i].speaker), rate: rate() });
      await new Promise(r => setTimeout(r, 350));
    }
    lines.forEach(n => n.classList.remove('playing'));
    playing = false;
  });
  ui.querySelector('.stop').addEventListener('click', () => { playing = false; stopSpeaking(); lines.forEach(n => n.classList.remove('playing')); });

  // Questions
  const qs = (data.questions || []).map(q => ({ type: 'choice', q: q.q, options: q.options, answer: [].concat(q.answer) }));
  if (qs.length) {
    const qBox = ui.querySelector('.qs');
    qBox.append(el('<h3>Questions</h3>'));
    const inner = el('<div></div>');
    qBox.append(inner);
    renderExercises(inner, qs, { onChecked: ({ pct }) => { if (pct >= 60) markDone(lesson.id, 'listening'); } });
  }

  // Dictation: listen to a line, write it, see which words you missed.
  const dict = ui.querySelector('.dict-body');
  const pick = data.script.filter(l => l.text.split(' ').length >= 4).slice(0, 4);
  pick.forEach((l, i) => {
    const row = el(`<div class="ex"><div class="row"><button class="btn secondary small">🔊 Sentence ${i + 1}</button><button class="btn ghost small slow">🐢 slower</button></div>
      <input type="text" style="margin-top:8px" placeholder="Write what you hear" autocomplete="off" spellcheck="false">
      <div class="row" style="margin-top:6px"><button class="btn small check">Check</button></div><div class="feedback"></div></div>`);
    row.querySelector('.btn.secondary').addEventListener('click', () => speak(l.text, { voiceName: voiceOf(l.speaker), rate: rate() }));
    row.querySelector('.slow').addEventListener('click', () => speak(l.text, { voiceName: voiceOf(l.speaker), rate: 0.6 }));
    row.querySelector('.check').addEventListener('click', () => {
      const got = new Set(normalize(row.querySelector('input').value).split(' '));
      const heard = w => normalize(w).split(' ').every(part => !part || got.has(part));
      const shown = l.text.split(/\s+/).map(w => `<span class="dict-word ${heard(w) ? 'ok' : 'miss'}">${esc(w)}</span>`).join(' ');
      const fb = row.querySelector('.feedback');
      fb.className = 'feedback';
      fb.innerHTML = shown;
    });
    dict.append(row);
  });
}

// ================= WRITING =================
export function writingView(lesson, root) {
  const s = getState();
  const w = lesson.writing;
  const card = el(`<div class="card">
    <h2>✍️ Writing</h2>
    <p><b>Task:</b> ${esc(w.task)}</p>
    ${w.tips?.length ? `<ul class="small muted">${w.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    <textarea placeholder="Write here…" spellcheck="false"></textarea>
    <div class="row between" style="margin-top:8px">
      <span class="muted small count">0 words</span>
      <button class="btn send">Check my writing</button>
    </div>
  </div>`);
  root.append(card);
  root.append(aiBlock('writing', lesson));
  const out = el('<div class="card ai-out hidden"></div>');
  root.append(out);

  const ta = card.querySelector('textarea');
  const count = card.querySelector('.count');
  ta.value = s.drafts[lesson.id] || '';
  const upd = () => {
    const n = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
    count.textContent = `${n} words${w.minWords ? ` (aim for ${w.minWords}+)` : ''}`;
  };
  upd();
  ta.addEventListener('input', () => { getState().drafts[lesson.id] = ta.value; save(); upd(); });

  card.querySelector('.send').addEventListener('click', async e => {
    const text = ta.value.trim();
    if (text.split(/\s+/).length < 5) { ta.focus(); return; }
    const btn = e.currentTarget;
    btn.disabled = true;
    out.classList.remove('hidden');
    out.innerHTML = '<p class="thinking">Your teacher is reading</p>';
    try {
      const { system, user } = P.writingFeedback(lesson, text);
      const reply = await chat({ system, messages: [{ role: 'user', content: user }], maxTokens: 2000 });
      out.innerHTML = md(reply);
      const fixes = parseFixes(reply);
      if (fixes.length) {
        addMistakes(fixes, lesson.id, 'writing');
        out.append(el(`<p class="muted small">📒 ${fixes.length} mistake(s) saved to <a href="#/mistakes">My mistakes</a>.</p>`));
      }
      markDone(lesson.id, 'writing');
    } catch (err) { showError(out, err); }
    btn.disabled = false;
  });
}

// ================= SPEAKING =================
export function speakingView(lesson, root) {
  const sp = lesson.speaking;
  const s = getState().settings;
  const card = el(`<div class="card">
    <h2>🗣️ Speaking</h2>
    <p><b>Situation:</b> ${esc(sp.scenario)}</p>
    <p><b>The AI is:</b> ${esc(sp.aiRole)}<br><b>Your goal:</b> ${esc(sp.goal)}</p>
    ${!canListen ? '<p class="banner small">Voice input works in Chrome and Edge (and Safari). In this browser, type your answers — or use “Copy prompt” with the voice mode of the Claude/ChatGPT/Gemini app.</p>' : ''}
    <div class="row">
      <button class="btn start">▶ Start conversation</button>
      <label style="display:flex;gap:6px;align-items:center;margin:0;font-weight:500"><input type="checkbox" class="auto" ${s.autoSpeak ? 'checked' : ''}> AI speaks out loud</label>
    </div>
  </div>`);
  root.append(card);
  root.append(aiBlock('speaking', lesson));

  const talk = el(`<div class="card hidden">
    <div class="chat"></div>
    <p class="muted small live"></p>
    <div class="composer">
      <button class="btn mic" title="Press to speak, press again to send">🎤</button>
      <input type="text" placeholder="Speak with 🎤 or type here, then Enter">
      <button class="btn secondary send">Send</button>
    </div>
    <div class="row between" style="margin-top:12px">
      <span class="muted small">Tip: speak in full sentences. Mistakes are good — they show what to learn.</span>
      <button class="btn secondary finish">🏁 Finish &amp; get feedback</button>
    </div>
  </div>`);
  root.append(talk);
  const out = el('<div class="card ai-out hidden"></div>');
  root.append(out);

  const chatBox = talk.querySelector('.chat');
  const input = talk.querySelector('.composer input');
  const live = talk.querySelector('.live');
  const micBtn = talk.querySelector('.mic');
  const auto = card.querySelector('.auto');
  auto.addEventListener('change', () => { getState().settings.autoSpeak = auto.checked; save(); });

  const system = P.speakingSystem(lesson);
  let messages = [];
  let busy = false;

  const addMsg = (who, text) => {
    let html;
    if (who === 'ai') {
      const [main, ...tips] = text.split('\n').reduce((acc, line) => {
        if (line.trim().startsWith('✏️')) acc.push(line.trim()); else acc[0] += (acc[0] ? '\n' : '') + line;
        return acc;
      }, ['']);
      html = `${esc(main.trim()).replace(/\n/g, '<br>')}${tips.map(t => `<span class="tip">${esc(t)}</span>`).join('')}`;
      const n = el(`<div class="msg ai">${html}</div>`);
      n.prepend(sayButton(main.trim()));
      chatBox.append(n);
      if (auto.checked) speak(main.trim());
    } else {
      chatBox.append(el(`<div class="msg me">${esc(text)}</div>`));
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  };

  const ask = async () => {
    busy = true;
    const thinking = el('<div class="msg ai thinking">…</div>');
    chatBox.append(thinking);
    chatBox.scrollTop = chatBox.scrollHeight;
    try {
      const reply = await chat({ system, messages, maxTokens: 400 });
      thinking.remove();
      messages.push({ role: 'assistant', content: reply });
      addMsg('ai', reply);
    } catch (err) {
      thinking.remove();
      chatBox.append(el(`<div class="error">${esc(err.message)}</div>`));
      if (messages.length > 1) {
        // Put the learner's sentence back so they can send it again.
        input.value = messages.pop().content;
        [...chatBox.querySelectorAll('.msg.me')].pop()?.remove();
      }
    }
    busy = false;
  };

  card.querySelector('.start').addEventListener('click', async e => {
    stopSpeaking();
    talk.classList.remove('hidden');
    out.classList.add('hidden');
    chatBox.innerHTML = '';
    messages = [{ role: 'user', content: '(The learner is ready. Start the role-play now with your first message.)' }];
    e.currentTarget.textContent = '↻ Restart conversation';
    await ask();
    input.focus();
  });

  const send = async () => {
    const text = input.value.trim();
    if (!text || busy) return;
    stopSpeaking();
    input.value = '';
    live.textContent = '';
    addMsg('me', text);
    messages.push({ role: 'user', content: text });
    await ask();
  };
  talk.querySelector('.send').addEventListener('click', send);
  input.addEventListener('keydown', e => e.key === 'Enter' && send());

  let rec = null;
  micBtn.addEventListener('click', async () => {
    if (rec) { rec.stop(); return; }
    if (!canListen) { live.textContent = 'Voice input is not supported in this browser — please type.'; return; }
    stopSpeaking();
    micBtn.classList.add('rec');
    micBtn.textContent = '⏹';
    live.textContent = 'Listening… press ⏹ when you finish.';
    rec = listen({ onInterim: t => { input.value = t; } });
    try {
      const said = await rec.promise;
      if (said) { input.value = said; await send(); }
      else live.textContent = 'I did not hear anything. Try again, closer to the microphone.';
    } catch (err) { live.textContent = err.message; }
    rec = null;
    micBtn.classList.remove('rec');
    micBtn.textContent = '🎤';
  });

  talk.querySelector('.finish').addEventListener('click', async e => {
    const learnerTurns = messages.filter((m, i) => m.role === 'user' && i > 0);
    if (!learnerTurns.length) { live.textContent = 'Say something first 🙂'; return; }
    stopSpeaking();
    const btn = e.currentTarget;
    btn.disabled = true;
    out.classList.remove('hidden');
    out.innerHTML = '<p class="thinking">Your teacher is preparing feedback</p>';
    const transcript = messages.slice(1)
      .map(m => `${m.role === 'user' ? 'Learner' : 'Teacher'}: ${m.content.split('\n').filter(l => !l.trim().startsWith('✏️')).join(' ')}`)
      .join('\n');
    try {
      const { system: fsys, user } = P.speakingFeedback(lesson, transcript);
      const reply = await chat({ system: fsys, messages: [{ role: 'user', content: user }], maxTokens: 1800 });
      out.innerHTML = md(reply);
      const fixes = parseFixes(reply);
      if (fixes.length) {
        addMistakes(fixes, lesson.id, 'speaking');
        out.append(el(`<p class="muted small">📒 ${fixes.length} mistake(s) saved to <a href="#/mistakes">My mistakes</a>.</p>`));
      }
      markDone(lesson.id, 'speaking');
      out.scrollIntoView({ behavior: 'smooth' });
    } catch (err) { showError(out, err); }
    btn.disabled = false;
  });
}
