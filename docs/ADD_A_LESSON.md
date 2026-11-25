# How to add a new lesson (10 minutes a day)

1. Pick the next ⬜ lesson in [ROADMAP.md](ROADMAP.md).
2. Copy the prompt below into Claude, ChatGPT or Gemini. Change the first two lines.
3. Save the JSON answer as a new file, e.g. `lessons/a1/07-simple-vs-continuous.json`.
4. Add one line to `lessons/index.json` (same `id`, `level`, `order`, `title`, `goal`, and the `file` path).
5. Check it: `node tools/validate-lessons.mjs`
6. **Read the lesson yourself** (or ask a second AI to check it). Fix anything strange.
7. Mark it ✅ in ROADMAP.md, commit and push. GitHub Pages updates in about a minute.

## The lesson prompt

```
LESSON: A1 lesson 7 — Present simple vs present continuous
ID: a1-07-simple-vs-continuous   ORDER: 7

You are an expert CEFR English teacher writing a lesson for an open-source practice app.
The learners already know vocabulary; they need GRAMMAR, LISTENING and SPEAKING.
Many learners are Arabic speakers — mention a typical Arabic-speaker mistake when it is useful.
Use only grammar the learner knows at this level (plus today's grammar). Real-life topics: work, tech, family, travel, city, health.

Return ONLY valid JSON with exactly this shape:
{
  "id": "<ID>", "level": "A1", "order": <ORDER>,
  "title": "<short title>",
  "goal": "<one sentence: what the learner can do after this lesson>",
  "keyPoints": ["4–5 short rules the AI teacher must focus on"],
  "grammar": {
    "explanation": ["3–5 short paragraphs. You may use **bold** and *italic*."],
    "table": { "headers": ["..."], "rows": [["..."]] },
    "examples": [{ "en": "example sentence", "note": "short note" }],           // 6 items
    "mistakes": [{ "wrong": "...", "right": "...", "why": "..." }]               // 4 items
  },
  "exercises": [                                                                  // 12 items, mix all 4 types
    { "type": "choice", "q": "Sentence with ___", "options": ["a","b","c"], "answer": ["b"] },
    { "type": "fill", "q": "Sentence with ___ (hint)", "answer": ["all", "accepted answers"] },
    { "type": "fix", "q": "Sentence with ONE mistake", "answer": ["Full corrected sentence."] },
    { "type": "order", "q": "words / in / wrong / order", "answer": ["Words in right order."] }
  ],
  "listening": {
    "title": "...",
    "script": [{ "speaker": "Name", "text": "1–2 sentences" }],                 // 10 lines, 2 speakers, uses today's grammar a lot
    "questions": [{ "q": "...", "options": ["...","...","..."], "answer": "<exactly one option>" }]  // 4 items, the last one about grammar
  },
  "writing": { "task": "...", "minWords": 70, "tips": ["2 tips that force today's grammar"] },
  "speaking": {
    "scenario": "a realistic situation",
    "aiRole": "who the AI plays",
    "goal": "what the learner must do, using today's grammar",
    "starter": "the AI's first sentence, ending with a question"
  }
}
```

## Rules for good lessons

- **Grammar first, no vocabulary lessons.** Use easy words so the grammar is the only challenge.
- Every listening dialogue and speaking scenario must *force* today's grammar many times.
- `answer` is always a list. For `fill`, give only the missing words; for `fix` and `order`, the full sentence. Add every acceptable version (with and without short forms is handled automatically).
- Keep explanations short. The AI teacher explains more when the learner asks.
