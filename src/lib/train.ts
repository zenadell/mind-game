import { desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { askJson, stripCode } from "./ai";
import { NotFound, markActive } from "./core";
import { award, comboBreak, comboHit, mergeEvents, type GameEvent } from "./game";
import { PATTERNS, PROBLEMS, buildTests, problemById, starterCode, type Difficulty, type Problem } from "./problems";
import {
  COMPLEXITY_SYSTEM,
  ComplexityShape,
  EDITORIAL_SYSTEM,
  EditorialShape,
  PRIMER_SYSTEM,
  PROBLEM_HINT_SYSTEM,
  READING_GRADE_SYSTEM,
  READING_SYSTEM,
  ReadingShape,
  StepShape,
  HintShape,
  CheckShape,
  type Editorial,
  type StepContent,
} from "./prompts";
import { normalize, printedBy } from "./quiz";
import { exampleCode, runExample } from "./steps";

// Train: interview problems by pattern, and code-reading challenges. Problems unlock only
// when the lessons they need are done. The same rules as exercises keep the work honest:
// hints come one at a time after real tries, and the model solution waits for real effort.

export const MAX_HINTS = 3;
export const FAILS_BEFORE_SOLUTION = 3;
/** Interview mode time limits, in minutes. */
export const INTERVIEW_MINUTES: Record<Difficulty, number> = { Easy: 15, Medium: 25, Hard: 40 };
const DIFF_ORDER: Record<Difficulty, number> = { Easy: 0, Medium: 1, Hard: 2 };
const SOLVE_XP = { Easy: "problemEasy", Medium: "problemMedium", Hard: "problemHard" } as const;

export type ProblemStatus = "locked" | "new" | "tried" | "studied" | "solved";
type Row = typeof schema.problemState.$inferSelect;

// ---------- Unlocking ----------

function completedLessons(): Set<string> {
  return new Set(
    db()
      .select({ id: schema.progress.lessonId })
      .from(schema.progress)
      .where(eq(schema.progress.status, "completed"))
      .all()
      .map((r) => r.id),
  );
}

function lessonTitles(): Map<string, string> {
  return new Map(db().select({ id: schema.lessons.id, title: schema.lessons.title }).from(schema.lessons).all().map((l) => [l.id, l.title]));
}

/** The lessons still to finish before a problem unlocks (empty = unlocked). */
export function missingLessons(p: Problem, done: Set<string>): string[] {
  return p.requires.filter((id) => !done.has(id));
}

// ---------- State ----------

function row(problemId: string): Row {
  return (
    db().select().from(schema.problemState).where(eq(schema.problemState.problemId, problemId)).get() ?? {
      problemId,
      attempts: 0,
      failed: 0,
      hintsJson: "[]",
      solutionShown: false,
      solvedAt: null,
      interviewStart: null,
      interviewMs: null,
      complexityOk: false,
      code: null,
      updatedAt: Date.now(),
    }
  );
}

function save(r: Row) {
  const v = { ...r, updatedAt: Date.now() };
  db().insert(schema.problemState).values(v).onConflictDoUpdate({ target: schema.problemState.problemId, set: v }).run();
}

const hintsOf = (r: Row): string[] => JSON.parse(r.hintsJson);

export function statusOf(r: Row | undefined, locked: boolean): ProblemStatus {
  if (locked) return "locked";
  if (!r) return "new";
  if (r.solvedAt) return r.solutionShown ? "studied" : "solved";
  return r.attempts > 0 || r.solutionShown ? "tried" : "new";
}

/** Hint N needs N real tries first (Submit with failing tests), and none in interview mode. */
export function canTakeHint(r: Row): { ok: boolean; reason?: string } {
  const used = hintsOf(r).length;
  if (r.solvedAt) return { ok: false, reason: "You already solved it." };
  if (r.interviewStart) return { ok: false, reason: "Interview mode: no hints. Stop the interview to get hints." };
  if (used >= MAX_HINTS) return { ok: false, reason: "You've used all 3 hints." };
  if (r.failed <= used) return { ok: false, reason: used ? "Use the last hint first: change your code and Submit." : "Try first: write your attempt and press Submit. A hint unlocks after a real try." };
  return { ok: true };
}

/** The model solution unlocks after all hints and 3 failed submits, or once solved. */
export function canSeeSolution(r: Row): boolean {
  return !!r.solvedAt || (hintsOf(r).length >= MAX_HINTS && r.failed >= FAILS_BEFORE_SOLUTION);
}

function publicState(p: Problem, r: Row) {
  const hints = hintsOf(r);
  return {
    attempts: r.attempts,
    failed: r.failed,
    hints,
    canHint: canTakeHint(r),
    solutionShown: r.solutionShown,
    canSeeSolution: canSeeSolution(r),
    solved: !!r.solvedAt,
    studied: !!r.solvedAt && r.solutionShown,
    interview: r.interviewStart ? { start: r.interviewStart, limitMs: INTERVIEW_MINUTES[p.difficulty] * 60_000 } : null,
    interviewMs: r.interviewMs,
    complexityOk: r.complexityOk,
    code: r.code,
  };
}
export type ProblemState = ReturnType<typeof publicState>;

function getProblem(id: string): Problem {
  const p = problemById(id);
  if (!p) throw new NotFound("No such problem.");
  return p;
}

function unlockedProblem(id: string): Problem {
  const p = getProblem(id);
  const missing = missingLessons(p, completedLessons());
  if (missing.length) {
    const titles = lessonTitles();
    throw new NotFound(`This problem is locked. Finish these lessons first: ${missing.map((m) => titles.get(m) ?? m).join(", ")}.`);
  }
  return p;
}

// ---------- Overview ----------

export function trainOverview() {
  const done = completedLessons();
  const titles = lessonTitles();
  const states = new Map(db().select().from(schema.problemState).all().map((r) => [r.problemId, r]));
  const problems = PROBLEMS.map((p) => {
    const missing = missingLessons(p, done);
    const r = states.get(p.id);
    return {
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      pattern: p.pattern,
      leetcode: p.leetcode ?? null,
      status: statusOf(r, missing.length > 0),
      missing: missing.map((m) => ({ id: m, title: titles.get(m) ?? m })),
      interviewMs: r?.interviewMs ?? null,
    };
  });
  const patterns = PATTERNS.map((pt) => {
    const list = problems.filter((p) => p.pattern === pt.id).sort((a, b) => DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty]);
    return { ...pt, problems: list, solved: list.filter((p) => p.status === "solved" || p.status === "studied").length };
  });
  // Today's problem: the first unlocked one you haven't solved, easiest first in path order.
  const next = patterns.flatMap((p) => p.problems).find((p) => p.status === "new" || p.status === "tried") ?? null;
  const solved = problems.filter((p) => p.status === "solved").length;
  const reading = readingStats();
  return {
    patterns,
    next,
    totals: {
      solved,
      studied: problems.filter((p) => p.status === "studied").length,
      unlocked: problems.filter((p) => p.status !== "locked").length,
      all: problems.length,
      byDifficulty: (["Easy", "Medium", "Hard"] as Difficulty[]).map((d) => ({
        difficulty: d,
        solved: problems.filter((p) => p.difficulty === d && p.status === "solved").length,
        all: problems.filter((p) => p.difficulty === d).length,
      })),
    },
    reading,
  };
}

/** Everything the workspace page needs. The model solution stays on the server. */
export function problemView(id: string) {
  const p = getProblem(id);
  const done = completedLessons();
  const titles = lessonTitles();
  const missing = missingLessons(p, done);
  const r = row(id);
  const pattern = PATTERNS.find((x) => x.id === p.pattern)!;
  return {
    problem: {
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      pattern,
      leetcode: p.leetcode ?? null,
      fn: p.fn,
      design: !!p.methods,
      statement: p.statement,
      examples: p.cases.slice(0, p.examples),
      hiddenCount: p.cases.length - p.examples,
      requires: p.requires.map((m) => ({ id: m, title: titles.get(m) ?? m, done: done.has(m) })),
      starter: starterCode(p),
      tests: { examples: buildTests(p, "examples"), all: buildTests(p, "all") },
      interviewMinutes: INTERVIEW_MINUTES[p.difficulty],
    },
    locked: missing.length > 0,
    primerReady: !!cacheGet(`primer:${p.pattern}`),
    state: publicState(p, r),
  };
}

// ---------- Solving ----------

/**
 * Record a Submit. The browser runs every test (visible and hidden) in the sandbox and
 * reports the result. The first full pass pays XP: more for harder problems, a bonus for no
 * hints, and a bonus for beating the interview clock.
 */
export function submit(id: string, code: string, passed: boolean) {
  const p = unlockedProblem(id);
  const r = row(p.id);
  const next: Row = { ...r, code: code.slice(0, 20000), attempts: r.attempts + 1, failed: passed ? r.failed : r.failed + 1 };
  const events: (GameEvent | null)[] = [];
  let firstSolve = false;
  if (passed && !r.solvedAt) {
    firstSolve = true;
    next.solvedAt = Date.now();
    if (r.solutionShown) {
      events.push(award("problemStudied", `Rebuilt from the solution: ${p.title}`, { key: `problem:${p.id}` }));
    } else {
      events.push(award(SOLVE_XP[p.difficulty], `Solved ${p.difficulty}: ${p.title}`, { key: `problem:${p.id}` }));
      if (!hintsOf(r).length) events.push(award("problemClean", "No hints!", { key: `problemclean:${p.id}` }));
    }
    if (r.interviewStart) {
      const ms = Date.now() - r.interviewStart;
      next.interviewStart = null;
      next.interviewMs = ms;
      if (ms <= INTERVIEW_MINUTES[p.difficulty] * 60_000 && !r.solutionShown)
        events.push(award("interview", "Beat the interview clock", { key: `interview:${p.id}` }));
    }
    if (!r.solutionShown) events.push(patternBonus(p));
  }
  save(next);
  markActive();
  return { passed, firstSolve, state: publicState(p, next), game: mergeEvents(events) };
}

/** Solving every problem in a pattern (on your own) pays a bonus once. */
function patternBonus(p: Problem): GameEvent | null {
  const ids = PROBLEMS.filter((x) => x.pattern === p.pattern).map((x) => x.id);
  const rows = db().select().from(schema.problemState).where(inArray(schema.problemState.problemId, ids)).all();
  const solved = new Set(rows.filter((r) => r.solvedAt && !r.solutionShown).map((r) => r.problemId));
  solved.add(p.id);
  if (!ids.every((id) => solved.has(id))) return null;
  const title = PATTERNS.find((x) => x.id === p.pattern)?.title ?? p.pattern;
  return award("patternDone", `Pattern mastered: ${title}`, { key: `pattern:${p.pattern}` });
}

export async function hint(id: string, code: string, failure: string) {
  const p = unlockedProblem(id);
  const r = row(p.id);
  const allowed = canTakeHint(r);
  if (!allowed.ok) return { hint: null, reason: allowed.reason, state: publicState(p, r) };
  const given = hintsOf(r);
  const level = given.length + 1;
  const res = await askJson({
    purpose: "hint",
    role: "tutor",
    system: PROBLEM_HINT_SYSTEM,
    prompt: `Give a level ${level} hint.${given.length ? `\n\nHints already given:\n${given.map((h, i) => `${i + 1}. ${h}`).join("\n")}` : ""}\n\n<problem>\n${p.statement}\n</problem>\n\n<reference_solution_secret>\n${p.ref}\n</reference_solution_secret>\n\n<learner_code>\n${code.slice(0, 8000)}\n</learner_code>\n\n<failing_test>\n${failure.slice(0, 1500)}\n</failing_test>`,
    shape: HintShape,
    maxTokens: 16000,
  });
  const next = { ...r, code: code.slice(0, 20000), hintsJson: JSON.stringify([...given, stripCode(res.hint)]) };
  save(next);
  markActive();
  return { hint: stripCode(res.hint), level, state: publicState(p, next) };
}

/** Interview mode: a timer, no hints. Starting again restarts the clock. */
export function interview(id: string, action: "start" | "stop") {
  const p = unlockedProblem(id);
  const r = row(p.id);
  const next = { ...r, interviewStart: action === "start" ? Date.now() : null };
  save(next);
  return { state: publicState(p, next) };
}

// ---------- After solving: walkthrough, complexity interview ----------

/** The model solution and a walkthrough. Unlocks after solving, or after real effort (giving up). */
export async function solution(id: string) {
  const p = unlockedProblem(id);
  const r = row(p.id);
  if (!canSeeSolution(r))
    throw new NotFound(`The solution unlocks after you use all ${MAX_HINTS} hints and ${FAILS_BEFORE_SOLUTION} submits still fail. Keep going: struggle is where the learning happens.`);
  const next = r.solvedAt ? r : { ...r, solutionShown: true, interviewStart: null };
  if (next !== r) save(next);
  const editorial = await cachedJson(`editorial:${p.id}`, (j) => EditorialShape.parse(j), () =>
    askJson({
      purpose: "editorial",
      role: "tutor",
      system: EDITORIAL_SYSTEM,
      prompt: `<problem title="${p.title}">\n${p.statement}\n</problem>\n\n<model_solution>\n${p.ref}\n</model_solution>\n\n<best_complexity>${p.complexity}</best_complexity>\n\n<learner_code>\n${r.solvedAt ? (r.code ?? "") : ""}\n</learner_code>`,
      shape: EditorialShape,
      maxTokens: 32000,
    }),
  );
  return { ref: p.ref, complexity: p.complexity, editorial: alignLines(editorial, p.ref), state: publicState(p, next) };
}

/** Use the real solution's lines (the model sometimes re-types them slightly differently). */
function alignLines(e: Editorial, ref: string): Editorial {
  const real = ref.split("\n");
  if (e.lines.length !== real.length) return e;
  return { ...e, lines: e.lines.map((l, i) => ({ ...l, code: real[i] })) };
}

/** The interview follow-up: "What's the time and space complexity, and why?" */
export async function complexity(id: string, answer: string) {
  const p = unlockedProblem(id);
  const r = row(p.id);
  if (!r.solvedAt) throw new NotFound("Solve the problem first, then the interviewer asks about complexity.");
  const res = await askJson({
    purpose: "grade-complexity",
    role: "grader",
    system: COMPLEXITY_SYSTEM,
    prompt: `<problem>\n${p.statement}\n</problem>\n\n<candidate_code>\n${r.code ?? ""}\n</candidate_code>\n\n<best_known>${p.complexity}</best_known>\n\nCandidate's answer: ${answer.slice(0, 2000)}`,
    shape: ComplexityShape,
    maxTokens: 16000,
  });
  const right = res.verdict === "correct";
  const next = { ...r, complexityOk: r.complexityOk || right };
  save(next);
  markActive();
  const game = right ? award("complexity", "Nailed the complexity", { key: `complexity:${p.id}` }) : null;
  return { verdict: res.verdict, feedback: stripCode(res.feedback), state: publicState(p, next), game };
}

// ---------- Learn the pattern ----------

/** A from-zero lesson on a pattern, with a worked example that is not one of its problems. */
export async function primer(patternId: string): Promise<StepContent> {
  const pattern = PATTERNS.find((x) => x.id === patternId);
  if (!pattern) throw new NotFound("No such pattern.");
  const done = completedLessons();
  const list = PROBLEMS.filter((p) => p.pattern === patternId);
  if (!list.some((p) => !missingLessons(p, done).length)) throw new NotFound("Finish the lessons this pattern needs first.");
  return cachedJson(`primer:${patternId}`, (j) => StepShape.parse(j), async () => {
    const prompt = `Pattern: ${pattern.title} (${pattern.blurb})\n\nThe learner will solve these problems alone afterwards, so your worked example must be a DIFFERENT problem and must not give away any of them:\n${list.map((p) => `- ${p.title}`).join("\n")}`;
    let fix = "";
    for (let i = 0; i < 2; i++) {
      const c = await askJson({ purpose: "teach-from-zero", role: "tutor", system: PRIMER_SYSTEM, prompt: prompt + fix, shape: StepShape, maxTokens: 32000 });
      if (c.example.language !== "javascript" || !c.example.lines.length) return c;
      const run = runExample(exampleCode(c));
      if (run.ok) return { ...c, output: run.output };
      fix = `\n\nYour last worked example failed when run (${run.output}). Write one that runs.`;
    }
    throw new Error("The tutor's worked example didn't run. Press the button again.");
  });
}

// ---------- Code reading ----------

const READING_KINDS = ["output", "bug", "explain"] as const;
type ReadingKind = (typeof READING_KINDS)[number];
/** Code reading opens once the basics (functions, loops, conditions) are done. */
export const READING_REQUIRES = ["function-basics", "while-for", "ifelse"];

function readingStats() {
  const all = db().select().from(schema.readings).where(isNotNull(schema.readings.answeredAt)).all();
  const done = completedLessons();
  return {
    unlocked: READING_REQUIRES.every((id) => done.has(id)),
    answered: all.length,
    right: all.filter((r) => r.verdict === "correct").length,
  };
}

function publicReading(r: typeof schema.readings.$inferSelect) {
  const answered = !!r.answeredAt;
  return {
    id: r.id,
    kind: r.kind as ReadingKind,
    topic: r.topic,
    code: r.code,
    question: r.question,
    options: JSON.parse(r.optionsJson) as string[],
    answer: r.answer,
    verdict: r.verdict,
    feedback: r.feedback,
    // Only shown after answering.
    correctIndex: answered ? r.correctIndex : null,
    explain: answered ? r.explain : null,
    answerKey: answered ? r.answerKey : null,
  };
}
export type Reading = ReturnType<typeof publicReading>;

/** The open challenge, or a fresh one written from the lessons you've finished. */
export async function nextReading(fresh = false) {
  const d = db();
  if (!readingStats().unlocked) throw new NotFound("Code reading unlocks after the lessons on conditions, loops and functions.");
  const open = d.select().from(schema.readings).where(isNull(schema.readings.answeredAt)).orderBy(desc(schema.readings.id)).get();
  if (open && !fresh) return { reading: publicReading(open), stats: readingStats() };
  const count = d.select().from(schema.readings).all().length;
  const kind = READING_KINDS[count % READING_KINDS.length];
  const r = await writeReading(kind);
  if (open) d.delete(schema.readings).where(eq(schema.readings.id, open.id)).run(); // skipped
  return { reading: publicReading(r), stats: readingStats() };
}

async function writeReading(kind: ReadingKind) {
  const done = completedLessons();
  const titles = lessonTitles();
  const lessons = [...done].map((id) => titles.get(id) ?? id);
  const recent = db().select({ topic: schema.readings.topic }).from(schema.readings).orderBy(desc(schema.readings.id)).limit(6).all();
  const prompt = `Kind: ${kind}\n\nLessons the learner has finished (use only these features):\n${lessons.map((l) => `- ${l}`).join("\n")}\n\nRecent topics (pick something different): ${recent.map((r) => r.topic).join(", ") || "none"}`;
  for (let i = 0; i < 2; i++) {
    const c = await askJson({ purpose: "reading", role: "tutor", system: READING_SYSTEM, prompt, shape: ReadingShape, maxTokens: 32000 });
    let options = c.options;
    let correct = c.correct_index;
    if (kind === "output") {
      // The answer key is what the code really prints, never what the model thinks it prints.
      const printed = printedBy(c.code);
      if (printed === null || options.length < 2) continue;
      const hit = options.findIndex((o) => normalize(o) === normalize(printed));
      if (hit >= 0) correct = hit;
      else {
        options = [...options];
        correct = correct >= 0 && correct < options.length ? correct : 0;
        options[correct] = printed;
      }
    } else {
      options = [];
      correct = -1;
    }
    return db()
      .insert(schema.readings)
      .values({
        kind,
        topic: c.topic.slice(0, 60),
        code: c.code,
        question: c.question,
        optionsJson: JSON.stringify(options),
        correctIndex: correct,
        answerKey: c.answer_key,
        explain: c.explain,
        createdAt: Date.now(),
      })
      .returning()
      .get();
  }
  throw new Error("The tutor's code didn't run correctly twice. Press the button again.");
}

export async function answerReading(id: number, answer: { choice?: number; text?: string }) {
  const d = db();
  const r = d.select().from(schema.readings).where(eq(schema.readings.id, id)).get();
  if (!r) throw new NotFound("No such challenge.");
  if (r.answeredAt) return { reading: publicReading(r), stats: readingStats(), game: null };
  let verdict: "correct" | "partly" | "wrong";
  let feedback: string;
  let text: string;
  if (r.kind === "output") {
    const options: string[] = JSON.parse(r.optionsJson);
    const choice = Number(answer.choice);
    text = options[choice] ?? "";
    verdict = choice === r.correctIndex ? "correct" : "wrong";
    feedback = verdict === "correct" ? "Exactly right." : "Not quite. Read the explanation and trace it again, line by line.";
  } else {
    text = (answer.text ?? "").slice(0, 3000);
    const res = await askJson({
      purpose: "grade-reading",
      role: "grader",
      system: READING_GRADE_SYSTEM,
      prompt: `<code (lines numbered as the learner sees them)>\n${r.code.split("\n").map((l, i) => `${i + 1}  ${l}`).join("\n")}\n</code>\n\nQuestion: ${r.question}\n\nAnswer key: ${r.answerKey}\n\nLearner answer: ${text}`,
      shape: CheckShape,
      maxTokens: 16000,
    });
    verdict = res.verdict;
    feedback = res.feedback; // nothing to give away here: the model answer is shown next anyway
  }
  const saved = d
    .update(schema.readings)
    .set({ answer: text, verdict, feedback, answeredAt: Date.now() })
    .where(eq(schema.readings.id, id))
    .returning()
    .get();
  markActive();
  if (verdict === "correct") comboHit();
  else comboBreak();
  const game = mergeEvents([
    award("readingTry", "Read the code", { key: `readingtry:${id}` }),
    verdict === "correct" ? award("readingRight", "Code reader!", { key: `reading:${id}`, combo: true }) : null,
  ]);
  return { reading: publicReading(saved), stats: readingStats(), game };
}

// ---------- Cache ----------

function cacheGet(key: string): string | null {
  return db().select().from(schema.trainCache).where(eq(schema.trainCache.key, key)).get()?.json ?? null;
}

async function cachedJson<T>(key: string, parse: (j: unknown) => T, make: () => Promise<T>): Promise<T> {
  const hit = cacheGet(key);
  if (hit) {
    try {
      return parse(JSON.parse(hit));
    } catch {}
  }
  const value = await make();
  const json = JSON.stringify(value);
  db().insert(schema.trainCache).values({ key, json }).onConflictDoUpdate({ target: schema.trainCache.key, set: { json } }).run();
  return value;
}
