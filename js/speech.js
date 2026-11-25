// Free voice features built into the browser (no extra API needed).
// Listening = speechSynthesis (text -> voice). Speaking = SpeechRecognition (voice -> text, Chrome/Edge/Safari).
import { getState } from './store.js';

const synth = window.speechSynthesis;
let voicesCache = [];

function loadVoices() {
  voicesCache = synth ? synth.getVoices().filter(v => /^en(-|_|$)/i.test(v.lang)) : [];
  return voicesCache;
}
if (synth) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
}

export function englishVoices() { return voicesCache.length ? voicesCache : loadVoices(); }
export const canSpeak = Boolean(synth);

function pickVoice(name) {
  const voices = englishVoices();
  return voices.find(v => v.name === name) || voices.find(v => /en-US/i.test(v.lang)) || voices[0] || null;
}

/** Speak text. Resolves when finished (or cancelled). */
export function speak(text, { voiceName, rate } = {}) {
  return new Promise(resolve => {
    if (!synth || !text) return resolve();
    const s = getState().settings;
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(voiceName ?? s.voice);
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'en-US'; }
    u.rate = rate ?? s.rate ?? 0.9;
    u.onend = u.onerror = () => resolve();
    synth.speak(u);
  });
}

export function stopSpeaking() { synth?.cancel(); }

/** Two different voices for a two-person dialogue (if the device has them). */
export function dialogueVoices() {
  const voices = englishVoices();
  const main = pickVoice(getState().settings.voice);
  const other = voices.find(v => v !== main && v.lang.slice(0, 5) === main?.lang.slice(0, 5))
    || voices.find(v => v !== main) || main;
  return [main?.name, other?.name];
}

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = Boolean(Recognition);

/**
 * Start listening to the microphone.
 * @returns {{ promise: Promise<string>, stop: () => void }}
 */
export function listen({ onInterim } = {}) {
  if (!Recognition) {
    return { promise: Promise.reject(new Error('Speech recognition is not supported in this browser. Use Chrome or Edge, or type your answer.')), stop() {} };
  }
  const rec = new Recognition();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;
  let finalText = '';
  const promise = new Promise((resolve, reject) => {
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      onInterim?.((finalText + interim).trim());
    };
    rec.onerror = e => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      reject(new Error(e.error === 'not-allowed' ? 'Microphone permission was blocked. Allow the microphone for this site.' : `Speech recognition error: ${e.error}`));
    };
    rec.onend = () => resolve(finalText.trim());
  });
  rec.start();
  return { promise, stop: () => rec.stop() };
}
