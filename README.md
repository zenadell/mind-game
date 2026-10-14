# CodeTutor

A personal AI tutor that teaches JavaScript **from zero**, merging two great free courses:
[javascript.info](https://javascript.info) (depth) and [The Odin Project](https://www.theodinproject.com)
(beginner context: how the web works, HTML, running code in a page). It is built for learners who
find long pages of text hard: everything comes in small pieces, can be read aloud, and is checked.

## How a lesson works

1. **Planned from zero.** The first time you open a lesson, the tutor reads the javascript.info
   lesson and the matching Odin lessons, and plans small steps so nothing is ever used before it is
   explained (e.g. "What a web page is" → "Tags" → "The script tag" → "Your first line of code").
2. **Each step, one card at a time:**
   - 💡 **Why this matters**: the problem it solves
   - 📖 **New words**: every term and symbol, defined in plain English
   - ⚙️ **How it works**: step by step
   - 🧠 **Picture it**: an everyday analogy
   - 🔍 **The code, line by line**: what every line and symbol means, then **try it** yourself
     (HTML examples show the real page and its console)
   - 🌍 **In real life** and common mistakes
   - ✋ **Your turn**: one question, typed or 🎤 spoken. Two misses and the tutor explains it another way.
   Every card has 🔊 **Listen** and 🙋 **Explain this more simply** (asks the tutor chat).
3. **Teach-back**: explain the whole lesson in your own words. The tutor grades it.
4. **Practice**: the javascript.info exercises, in a real code editor with **Run** and **Check**.

Steps are written once and saved (the next step is written while you read the current one), and
every JavaScript example is run on the server first, so the output shown is the real output.
A lesson is complete only when every check, the teach-back, and every exercise pass.
Lessons unlock in order.

### Making it stick

- **Daily review** (spaced repetition): any question you miss comes back after 1 day,
  then 3, then 7. Miss it again and it starts over. The home page puts review first.
- **Quizzes** after every 3 lessons: 6 fresh questions written by the tutor, no hints.
  Pass with 70% to unlock the next lessons. "What does this code print?" questions are
  checked by actually running the code, so the answer key is never wrong.
- **Weekly report**: activity per day, how often you were right first time, and your
  weakest topics to redo every Sunday.
- **Reading settings** (the **Aa** button): text size and read-aloud speed. The font is
  Atkinson Hyperlegible, designed to make letters easy to tell apart.

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

You need [Node.js](https://nodejs.org) 20 or newer, Git, and an API key from any AI provider.

```bash
npm install
npm run import                 # downloads javascript.info + The Odin Project, builds the lessons
npm run dev                    # open http://localhost:3000
```

Then open **⚙️ Settings** in the app:

1. Pick a provider: DeepSeek, Anthropic (Claude), OpenAI, OpenRouter, Google Gemini, Groq,
   Ollama (free, runs on your computer), or any other OpenAI-compatible API.
2. Paste your API key.
3. Press **Load models**. The app asks the provider which models it has, so brand-new
   models show up without any code changes. Pick one.
4. Press **Test**, then **Save**.

The tutor (explains, hints, chats) and the grader (marks short answers) can use different
models or even different providers. Prefer files? Put the same settings in `.env.local`
(see `.env.example`); settings saved in the app win.

Use Chrome or Edge: they support voice input. Read-aloud works in all modern browsers.

**Try it without a key:** `CODETUTOR_FAKE_AI=1 npm run dev` uses canned offline replies,
so you can click through everything for free (the explanations will be placeholders).

## Cost

Every tutor message is a paid API call. The bar at the top shows today's cost (hover for the
total). Add your model's prices in Settings to see dollars; without prices it shows tokens.
To keep it low:

- Explanations are made once per step and saved, so re-opening a step is free.
- You can point the grader at a cheaper model than the tutor.
- The tutor only sees the current lesson, and that lesson text comes first in every request,
  so providers with prompt caching (DeepSeek, Claude, OpenAI) reuse it cheaply.

## How it's built

| Part | Where |
|---|---|
| Next.js app (pages + API routes) | `src/app` |
| Lesson, hint-ladder, completion, quiz-gating and streak rules | `src/lib/learning.ts` |
| Spaced-repetition reviews | `src/lib/review.ts` |
| Quizzes (generation, code-checked answers, grading) | `src/lib/quiz.ts` |
| Weekly report | `src/lib/report.ts` |
| Everything the tutor is told | `src/lib/prompts.ts` |
| AI calls for any provider, and cost tracking | `src/lib/ai.ts` |
| Which model does what (Settings + env vars) | `src/lib/models.ts` |
| Code runner (Web Worker, 3-second limit, fake `alert`/`prompt`, mocha-style tests) | `src/lib/sandbox*.{ts,js}` |
| Lesson planning and deep steps (both sources merged) | `src/lib/steps.ts` |
| javascript.info importer | `scripts/import-jsinfo.ts`, `src/lib/jsinfo-parse.ts` |
| The Odin Project importer and lesson mapping | `scripts/import-odin.ts`, `src/lib/odin.ts` |
| Database (SQLite + Drizzle, file in `data/`) | `src/db` |

```bash
npm test          # unit tests
npm run typecheck
```

## Content licenses

- [javascript.info](https://github.com/javascript-tutorial/en.javascript.info) by Ilya Kantor,
  [CC BY-NC](https://creativecommons.org/licenses/by-nc/4.0/).
- [The Odin Project curriculum](https://github.com/TheOdinProject/curriculum),
  [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).

Both are downloaded to your machine by `npm run import` and are **not** stored in this repository.
The lessons the tutor writes from them stay on your machine too. Use them for personal,
non-commercial learning, keep the attribution, and don't republish them.

## Roadmap

- **Phase 1 (done):** javascript.info Part 1, lesson steps, read-aloud, voice answers, tutor chat,
  code editor with tests, hint ladder, teach-back, progress and streak, any AI provider.
- **Phase 2 (done):** daily spaced-repetition review, quizzes every 3 lessons, weekly report,
  reading settings and a full design pass.
- **Phase 3:** The Odin Project path (HTML/CSS, Node, React), capstone projects.
- **Phase 4:** timed mastery exams with the tutor off, mock interviews, AI engineering track.
