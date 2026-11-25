# 🗣️ English AI Coach

**Free, open-source English practice for grammar, listening, writing and speaking — with the AI you already use: Claude, ChatGPT or Gemini.**

Made for learners who know enough words but struggle with **grammar, understanding spoken English, and speaking**. It starts at **A1** and goes to **A2**, with a new lesson added regularly.

## What each lesson gives you

| Session | What you do | Needs AI key? |
|---|---|---|
| 📘 **Grammar** | Short rule, form table, examples you can listen to, common mistakes, 12 exercises checked instantly. Ask the AI teacher questions or generate new exercises. | Exercises: no · extras: yes |
| 🎧 **Listening** | A dialogue read by two voices (slow / learner / natural speed), hidden transcript, questions, dictation. Generate unlimited new dialogues with AI. | Built-in dialogue: no |
| ✍️ **Writing** | A writing task that forces today's grammar. The AI corrects your text, lists every mistake and gives a score. | Yes |
| 🗣️ **Speaking** | A real role-play scenario. Talk with your **microphone**; the AI answers out loud, stays in character, and corrects one mistake per turn. Then get full feedback. | Yes |

Every mistake from writing, speaking and exercises goes into **My mistakes** — your personal grammar book. One click turns them into new exercises.

**No API key?** Every AI session has a **“Copy prompt”** button. Paste it into the free Claude, ChatGPT or Gemini app (voice mode is great for speaking) and practise there.

## Use it

👉 **https://hamadtarawah-debug.github.io/english-ai-coach/**

1. Open **Settings**, choose Claude, ChatGPT or Gemini and paste your API key
   ([Claude](https://console.anthropic.com/settings/keys) · [OpenAI](https://platform.openai.com/api-keys) · [Gemini](https://aistudio.google.com/app/apikey)).
2. Press **Test connection**.
3. Start lesson 1. Do all four sessions. One lesson a day.

Use **Chrome or Edge** for the microphone (speech recognition). Listening works in all modern browsers.

### Privacy
There is no server. Your key, progress and mistakes are stored **only in your browser** (localStorage). The key is sent only to the AI provider you choose. Set a spending limit on your key, and don't save it on a shared computer.

## Run it locally

```bash
git clone https://github.com/hamadtarawah-debug/english-ai-coach.git
cd english-ai-coach
python3 -m http.server 8000      # then open http://localhost:8000
```
No build step, no dependencies — plain HTML, CSS and JavaScript.

## Project structure

```
index.html            the page
css/style.css         design (light + dark)
js/app.js             pages: lessons, lesson, mistakes, settings
js/sessions.js        the 4 sessions: grammar, listening, writing, speaking
js/prompts.js         ⭐ the teacher prompts — improve these to improve every lesson
js/ai.js              one chat() function for Claude / OpenAI-compatible / Gemini
js/speech.js          browser text-to-speech and speech recognition
js/store.js           progress, mistakes, settings (localStorage)
lessons/index.json    list of lessons
lessons/a1/*.json     one file per lesson
tools/validate-lessons.mjs   checks lessons (also runs on every push)
docs/ROADMAP.md       the A1 → A2 lesson plan
docs/ADD_A_LESSON.md  how to add a lesson (with a ready AI prompt)
```

## Contributing

New lessons are the most useful contribution — see [docs/ADD_A_LESSON.md](docs/ADD_A_LESSON.md) and pick a ⬜ lesson from the [roadmap](docs/ROADMAP.md). Better prompts in `js/prompts.js`, bug fixes and translations are welcome too. Run `node tools/validate-lessons.mjs` before opening a pull request.

## License

MIT
