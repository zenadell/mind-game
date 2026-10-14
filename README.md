# CodeTutor

A personal AI tutor that teaches JavaScript **one small idea at a time**, using
[javascript.info](https://javascript.info) as the textbook. It is built for
learners who find long pages of text hard: every step is short, can be read
aloud, and ends with a question.

## The learning loop

For every lesson:

1. **Explain**: one small idea in about 120 words, with an everyday analogy. Press 🔊 to hear it.
2. **Try it**: a tiny code example you can run and change.
3. **Check**: one question. Type or 🎤 speak your answer. You can't move on until it's right.
   Get it wrong twice and the tutor explains it a different way.
4. **Teach-back**: explain the whole lesson in your own words. The tutor grades it.
5. **Practice**: the javascript.info exercises, in a real code editor with **Run** and **Check**.

A lesson is complete only when every check, the teach-back, and every exercise pass.
Lessons unlock in order.

### The tutor never writes your code

This is enforced by the app, not just asked of the AI:

- **Hints come in 3 levels**: a guiding question → the concept you need → a plain-English plan.
  Each new hint unlocks only after you try again.
- **The solution unlocks** only after all 3 hints *and* 3 failed tries.
- **After you see a solution**, the exercise doesn't count until you retype it from memory
  (pasting is turned off) and explain every line.
- Hints and feedback have code blocks stripped out before you see them.
- The tutor chat is told never to solve the lesson's exercises.

## Setup (one time)

You need [Node.js](https://nodejs.org) 20 or newer, Git, and an
[Anthropic API key](https://console.anthropic.com).

```bash
npm install
cp .env.example .env.local     # then open .env.local and paste your API key
npm run import                 # downloads javascript.info and builds the lessons
npm run dev                    # open http://localhost:3000
```

Use Chrome or Edge: they support voice input. Read-aloud works in all modern browsers.

**Try it without a key:** `CODETUTOR_FAKE_AI=1 npm run dev` uses canned offline replies,
so you can click through everything for free (the explanations will be placeholders).

## Cost

Every tutor message is a paid API call. The bar at the top shows what you've spent today
(hover for the total). To keep it low:

- Explanations are made once per step and saved, so re-opening a step is free.
- Short answers are graded by a cheap model (`GRADER_MODEL`, default Claude Haiku 5.5);
  teaching uses a stronger one (`TUTOR_MODEL`, default Claude Opus 5.5) at low effort.
- The tutor only sees the current lesson, and that lesson text is prompt-cached.

## How it's built

| Part | Where |
|---|---|
| Next.js app (pages + API routes) | `src/app` |
| Lesson, hint-ladder, completion and streak rules | `src/lib/learning.ts` |
| Everything the tutor is told | `src/lib/prompts.ts` |
| Claude API calls and cost tracking | `src/lib/ai.ts` |
| Code runner (Web Worker, 3-second limit, fake `alert`/`prompt`, mocha-style tests) | `src/lib/sandbox*.{ts,js}` |
| javascript.info importer | `scripts/import-jsinfo.ts`, `src/lib/jsinfo-parse.ts` |
| Database (SQLite + Drizzle, file in `data/`) | `src/db` |

```bash
npm test          # unit tests
npm run typecheck
```

## Content license

Lesson content comes from [javascript.info](https://github.com/javascript-tutorial/en.javascript.info)
by Ilya Kantor, licensed [CC BY-NC](https://creativecommons.org/licenses/by-nc/4.0/). It is
downloaded to your machine by `npm run import` and is **not** stored in this repository.
Use it for personal, non-commercial learning, keep the attribution, and don't republish it.

## Roadmap

- **Phase 1 (this):** javascript.info Part 1, lesson steps, read-aloud, voice answers, tutor chat,
  code editor with tests, hint ladder, teach-back, progress and streak.
- **Phase 2:** daily spaced-repetition review, quizzes, weekly report.
- **Phase 3:** The Odin Project path (HTML/CSS, Node, React), capstone projects.
- **Phase 4:** timed mastery exams with the tutor off, mock interviews, AI engineering track.
