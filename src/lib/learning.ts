import { asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { GRADER_MODEL, TUTOR_MODEL, askJson, stripCode } from "./ai";
import {
  CHECK_SYSTEM,
  CheckShape,
  EXERCISE_GRADE_SYSTEM,
  EXPLAIN_SOLUTION_SYSTEM,
  EXPLAIN_SYSTEM,
  ExerciseGradeShape,
  ExplainShape,
  HINT_SYSTEM,
  HintShape,
  TEACHBACK_SYSTEM,
  TeachbackShape,
  type Explain,
} from "./prompts";

// ---------- Hint ladder rules (enforced here, not just in the prompt) ----------

export const MAX_HINTS = 3;
export const ATTEMPTS_BEFORE_SOLUTION = 3;

export type ExerciseState = typeof schema.exerciseState.$inferSelect;

const EMPTY_STATE = (exerciseId: string): ExerciseState => ({
  exerciseId,
  hintsUsed: 0,
  failedAttempts: 0,
  solutionShown: false,
  passed: false,
  retypePassed: false,
  explainPassed: false,
});

/** Hint N is allowed only after N-1 failed tries, so the learner always tries first. */
export function canTakeHint(s: ExerciseState): { ok: boolean; reason?: string } {
  if (s.hintsUsed >= MAX_HINTS) return { ok: false, reason: "You've used all 3 hints." };
  if (s.failedAttempts < s.hintsUsed)
    return { ok: false, reason: "Try the last hint first: change your code and press Check." };
  return { ok: true };
}

/** The solution unlocks only after all hints and 3 failed attempts. */
export function canSeeSolution(s: ExerciseState): boolean {
  return s.hintsUsed >= MAX_HINTS && s.failedAttempts >= ATTEMPTS_BEFORE_SOLUTION;
}

/** Done = passed on their own, or (after seeing the solution) retyped it and explained every line. */
export function exerciseDone(s: ExerciseState): boolean {
  if (!s.passed) return false;
  return !s.solutionShown || (s.retypePassed && s.explainPassed);
}

export function getState(exerciseId: string): ExerciseState {
  return (
    db().select().from(schema.exerciseState).where(eq(schema.exerciseState.exerciseId, exerciseId)).get() ??
    EMPTY_STATE(exerciseId)
  );
}

function saveState(s: ExerciseState) {
  db()
    .insert(schema.exerciseState)
    .values(s)
    .onConflictDoUpdate({ target: schema.exerciseState.exerciseId, set: s })
    .run();
}

// ---------- Activity and streak ----------

const TZ = process.env.LEARNER_TZ || "Africa/Lagos";

export function dayKey(t = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
}

export function markActive() {
  db().insert(schema.activity).values({ day: dayKey() }).onConflictDoNothing().run();
}

/** Days in a row with activity, counting today (or up to yesterday if not yet active today). */
export function streak(days: string[], today = dayKey()): number {
  const set = new Set(days);
  const d = new Date(today + "T12:00:00Z");
  if (!set.has(today)) d.setUTCDate(d.getUTCDate() - 1);
  let n = 0;
  while (set.has(d.toISOString().slice(0, 10))) {
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}

export function stats() {
  const d = db();
  const days = d.select().from(schema.activity).all().map((r) => r.day);
  const cost = d
    .select({
      total: sql<number>`coalesce(sum(${schema.apiUsage.costUsd}), 0)`,
      today: sql<number>`coalesce(sum(case when ${schema.apiUsage.createdAt} >= ${startOfToday()} then ${schema.apiUsage.costUsd} end), 0)`,
    })
    .from(schema.apiUsage)
    .get()!;
  const completed = d.select().from(schema.progress).where(eq(schema.progress.status, "completed")).all().length;
  return { streak: streak(days), costTotal: cost.total, costToday: cost.today, completed };
}

function startOfToday(): number {
  // Midnight in the learner's time zone, approximated via the day key.
  const now = Date.now();
  const key = dayKey(now);
  let t = now - 24 * 3600_000;
  while (dayKey(t) !== key) t += 60_000 * 15;
  return t;
}

// ---------- Lessons and progress ----------

export function lessonList() {
  const d = db();
  const lessons = d.select().from(schema.lessons).orderBy(asc(schema.lessons.ord)).all();
  const prog = new Map(d.select().from(schema.progress).all().map((p) => [p.lessonId, p]));
  let unlocked = true; // lessons unlock in order
  return lessons.map((l) => {
    const p = prog.get(l.id);
    const status = p?.status === "completed" ? "completed" : unlocked ? (p ? "started" : "available") : "locked";
    if (status !== "completed") unlocked = false;
    return { ...l, status, mastery: p?.mastery ?? 0 };
  });
}

export function isUnlocked(lessonId: string): boolean {
  return lessonList().find((l) => l.id === lessonId)?.status !== "locked";
}

export function lessonDetail(lessonId: string) {
  const d = db();
  const lesson = d.select().from(schema.lessons).where(eq(schema.lessons.id, lessonId)).get();
  if (!lesson) return null;
  const chunks = d
    .select({ id: schema.chunks.id, ord: schema.chunks.ord, heading: schema.chunks.heading, bodyMd: schema.chunks.bodyMd })
    .from(schema.chunks)
    .where(eq(schema.chunks.lessonId, lessonId))
    .orderBy(asc(schema.chunks.ord))
    .all();
  const exercises = d
    .select({
      id: schema.exercises.id,
      title: schema.exercises.title,
      promptMd: schema.exercises.promptMd,
      starterCode: schema.exercises.starterCode,
      tests: schema.exercises.tests,
      importance: schema.exercises.importance,
      sourceUrl: schema.exercises.sourceUrl,
    })
    .from(schema.exercises)
    .where(eq(schema.exercises.lessonId, lessonId))
    .orderBy(asc(schema.exercises.ord))
    .all()
    .map((e) => ({ ...e, state: publicState(getState(e.id)) }));
  const passedChunks = new Set(
    d
      .select({ chunkId: schema.checks.chunkId })
      .from(schema.checks)
      .where(eq(schema.checks.verdict, "correct"))
      .all()
      .map((c) => c.chunkId),
  );
  const teachback = d
    .select()
    .from(schema.teachbacks)
    .where(eq(schema.teachbacks.lessonId, lessonId))
    .orderBy(desc(schema.teachbacks.id))
    .get();
  const prog = d.select().from(schema.progress).where(eq(schema.progress.lessonId, lessonId)).get();
  const all = lessonList();
  const idx = all.findIndex((l) => l.id === lessonId);
  return {
    lesson,
    chunks: chunks.map((c) => ({ ...c, passed: passedChunks.has(c.id) })),
    exercises,
    teachbackPassed: teachback?.verdict === "understood",
    status: prog?.status ?? "available",
    chunkIndex: prog?.chunkIndex ?? 0,
    next: all[idx + 1] ?? null,
    locked: all[idx]?.status === "locked",
  };
}

export function publicState(s: ExerciseState) {
  return {
    hintsUsed: s.hintsUsed,
    failedAttempts: s.failedAttempts,
    passed: s.passed,
    solutionShown: s.solutionShown,
    retypePassed: s.retypePassed,
    explainPassed: s.explainPassed,
    done: exerciseDone(s),
    canHint: canTakeHint(s).ok,
    canSeeSolution: canSeeSolution(s) && !s.solutionShown,
  };
}

export function savePosition(lessonId: string, chunkIndex: number) {
  db()
    .insert(schema.progress)
    .values({ lessonId, status: "started", chunkIndex })
    .onConflictDoUpdate({ target: schema.progress.lessonId, set: { chunkIndex } })
    .run();
}

/** Mark the lesson complete when every gate is passed. Returns what is still missing. */
export function tryComplete(lessonId: string): { completed: boolean; missing: string[] } {
  const detail = lessonDetail(lessonId);
  if (!detail) return { completed: false, missing: ["lesson not found"] };
  const missing: string[] = [];
  const unchecked = detail.chunks.filter((c) => !c.passed).length;
  if (unchecked) missing.push(`${unchecked} check question${unchecked > 1 ? "s" : ""}`);
  if (!detail.teachbackPassed) missing.push("the teach-back");
  const open = detail.exercises.filter((e) => !e.state.done).length;
  if (open) missing.push(`${open} exercise${open > 1 ? "s" : ""}`);
  if (missing.length) return { completed: false, missing };

  if (detail.status !== "completed") {
    // Mastery: share of checks right on the first try, and exercises solved without the solution.
    const d = db();
    let firstTry = 0;
    for (const c of detail.chunks) {
      const first = d.select().from(schema.checks).where(eq(schema.checks.chunkId, c.id)).orderBy(asc(schema.checks.id)).get();
      if (first?.verdict === "correct") firstTry++;
    }
    const own = detail.exercises.filter((e) => !e.state.solutionShown).length;
    const parts = [firstTry / Math.max(1, detail.chunks.length)];
    if (detail.exercises.length) parts.push(own / detail.exercises.length);
    const mastery = parts.reduce((a, b) => a + b, 0) / parts.length;
    d.insert(schema.progress)
      .values({ lessonId, status: "completed", mastery, completedAt: Date.now() })
      .onConflictDoUpdate({
        target: schema.progress.lessonId,
        set: { status: "completed", mastery, completedAt: Date.now() },
      })
      .run();
  }
  return { completed: true, missing: [] };
}

// ---------- Teaching steps ----------

function chunkWithLesson(chunkId: number) {
  const d = db();
  const chunk = d.select().from(schema.chunks).where(eq(schema.chunks.id, chunkId)).get();
  if (!chunk) throw new NotFound("chunk");
  const lesson = d.select().from(schema.lessons).where(eq(schema.lessons.id, chunk.lessonId)).get()!;
  return { chunk, lesson };
}

export class NotFound extends Error {
  constructor(what: string) {
    super(`${what} not found`);
  }
}

/** Short explanation + check question for a chunk. Cached, unless `again` (re-explain differently). */
export async function explainChunk(chunkId: number, again?: { previous: Explain; wrongAnswers: string[] }) {
  const { chunk, lesson } = chunkWithLesson(chunkId);
  if (!again && chunk.explainJson) return ExplainShape.parse(JSON.parse(chunk.explainJson));
  const prompt = [
    `Lesson: "${lesson.title}". Piece: "${chunk.heading}".`,
    `<lesson_piece>\n${chunk.bodyMd}\n</lesson_piece>`,
    again
      ? `The learner did not get it yet. Previous explanation:\n${again.previous.explanation}\nPrevious analogy: ${again.previous.analogy}\nTheir wrong answers: ${again.wrongAnswers.join(" | ")}\nRe-explain differently: new analogy, simpler example, smaller step, and a new (easier) question.`
      : "Make the bite-size step.",
  ].join("\n\n");
  const result = await askJson({
    purpose: again ? "re-explain" : "explain",
    model: TUTOR_MODEL,
    system: EXPLAIN_SYSTEM,
    prompt,
    shape: ExplainShape,
  });
  if (!again) {
    db().update(schema.chunks).set({ explainJson: JSON.stringify(result) }).where(eq(schema.chunks.id, chunkId)).run();
  }
  return result;
}

export async function gradeCheck(chunkId: number, question: string, answerKey: string, answer: string) {
  const { chunk } = chunkWithLesson(chunkId);
  const res = await askJson({
    purpose: "grade-check",
    model: GRADER_MODEL,
    system: CHECK_SYSTEM,
    prompt: `<lesson_piece>\n${chunk.bodyMd}\n</lesson_piece>\n\nQuestion: ${question}\nAnswer key: ${answerKey}\n\nLearner answer: ${answer}`,
    shape: CheckShape,
    maxTokens: 1500,
  });
  db()
    .insert(schema.checks)
    .values({ chunkId, question, answer, verdict: res.verdict, feedback: res.feedback, createdAt: Date.now() })
    .run();
  markActive();
  return res;
}

export async function gradeTeachback(lessonId: string, text: string) {
  const detail = lessonDetail(lessonId);
  if (!detail) throw new NotFound("lesson");
  const summary = detail.chunks.map((c) => `## ${c.heading}\n${c.bodyMd}`).join("\n\n");
  const res = await askJson({
    purpose: "grade-teachback",
    model: GRADER_MODEL,
    system: TEACHBACK_SYSTEM,
    prompt: `Lesson: "${detail.lesson.title}"\n<lesson>\n${summary}\n</lesson>\n\nLearner teach-back:\n${text}`,
    shape: TeachbackShape,
    maxTokens: 1500,
  });
  db()
    .insert(schema.teachbacks)
    .values({ lessonId, text, verdict: res.verdict, feedback: res.feedback, createdAt: Date.now() })
    .run();
  markActive();
  return res;
}

function exerciseRow(id: string) {
  const ex = db().select().from(schema.exercises).where(eq(schema.exercises.id, id)).get();
  if (!ex) throw new NotFound("exercise");
  return ex;
}

export async function giveHint(exerciseId: string, code: string) {
  const ex = exerciseRow(exerciseId);
  const s = getState(exerciseId);
  const allowed = canTakeHint(s);
  if (!allowed.ok) return { hint: null, reason: allowed.reason, state: publicState(s) };
  const level = s.hintsUsed + 1;
  const res = await askJson({
    purpose: "hint",
    model: TUTOR_MODEL,
    system: HINT_SYSTEM,
    prompt: `Give a level ${level} hint.\n\n<task>\n${ex.promptMd}\n</task>\n\n<reference_solution_secret>\n${ex.solutionHidden}\n</reference_solution_secret>\n\n<learner_code>\n${code}\n</learner_code>`,
    shape: HintShape,
  });
  const next = { ...s, hintsUsed: level };
  saveState(next);
  markActive();
  return { hint: stripCode(res.hint), level, state: publicState(next) };
}

/**
 * Record a Check. For exercises with tests the browser runs them and reports the
 * result; otherwise the grader model judges the code.
 */
export async function submitAttempt(
  exerciseId: string,
  code: string,
  run: { testsPassed?: boolean; testReport?: string; output?: string },
) {
  const ex = exerciseRow(exerciseId);
  const s = getState(exerciseId);
  let passed: boolean;
  let feedback: string;
  if (ex.tests) {
    passed = !!run.testsPassed;
    feedback = passed ? "All tests pass." : run.testReport || "Some tests failed.";
  } else {
    const res = await askJson({
      purpose: "grade-exercise",
      model: GRADER_MODEL,
      system: EXERCISE_GRADE_SYSTEM,
      prompt: `<task>\n${ex.promptMd}\n</task>\n\n<reference_solution_secret>\n${ex.solutionHidden}\n</reference_solution_secret>\n\n<learner_code>\n${code}\n</learner_code>\n\n<output_when_run>\n${(run.output ?? "").slice(0, 2000)}\n</output_when_run>`,
      shape: ExerciseGradeShape,
      maxTokens: 1500,
    });
    passed = res.passed;
    feedback = stripCode(res.feedback);
  }
  const next: ExerciseState = {
    ...s,
    passed: s.passed || passed,
    failedAttempts: passed ? s.failedAttempts : s.failedAttempts + 1,
    // After the solution was shown, a pass counts as the retype-from-memory step.
    retypePassed: s.retypePassed || (s.solutionShown && passed),
  };
  saveState(next);
  db()
    .insert(schema.attempts)
    .values({ exerciseId, code, passed, feedback, hintsUsed: s.hintsUsed, createdAt: Date.now() })
    .run();
  markActive();
  return { passed, feedback, state: publicState(next) };
}

export function revealSolution(exerciseId: string) {
  const ex = exerciseRow(exerciseId);
  const s = getState(exerciseId);
  if (!s.solutionShown && !canSeeSolution(s)) {
    return {
      solution: null,
      reason: `The solution unlocks after all ${MAX_HINTS} hints and ${ATTEMPTS_BEFORE_SOLUTION} tries.`,
      state: publicState(s),
    };
  }
  // Seeing the solution resets "passed": the learner must retype it from memory and explain it.
  const next = { ...s, solutionShown: true, passed: s.solutionShown ? s.passed : false };
  saveState(next);
  return { solution: ex.solutionHidden, state: publicState(next) };
}

export async function gradeSolutionExplanation(exerciseId: string, code: string, explanation: string) {
  const ex = exerciseRow(exerciseId);
  const s = getState(exerciseId);
  if (!s.solutionShown) return { passed: false, feedback: "Nothing to explain yet.", state: publicState(s) };
  const res = await askJson({
    purpose: "grade-line-explanation",
    model: GRADER_MODEL,
    system: EXPLAIN_SOLUTION_SYSTEM,
    prompt: `<task>\n${ex.promptMd}\n</task>\n\n<learner_code>\n${code}\n</learner_code>\n\n<learner_explanation>\n${explanation}\n</learner_explanation>`,
    shape: ExerciseGradeShape,
    maxTokens: 1500,
  });
  const next = { ...s, explainPassed: s.explainPassed || res.passed };
  saveState(next);
  markActive();
  return { passed: res.passed, feedback: stripCode(res.feedback), state: publicState(next) };
}

// ---------- Chat history ----------

export function chatHistory(lessonId: string, limit = 20) {
  return db()
    .select({ role: schema.messages.role, content: schema.messages.content })
    .from(schema.messages)
    .where(eq(schema.messages.lessonId, lessonId))
    .orderBy(desc(schema.messages.id))
    .limit(limit)
    .all()
    .reverse() as { role: "user" | "assistant"; content: string }[];
}

export function saveMessage(lessonId: string, role: "user" | "assistant", content: string) {
  db().insert(schema.messages).values({ lessonId, role, content, createdAt: Date.now() }).run();
}

export function lessonContextForTutor(lessonId: string): string {
  const detail = lessonDetail(lessonId);
  if (!detail) throw new NotFound("lesson");
  const text = detail.chunks.map((c, i) => `### Step ${i + 1}: ${c.heading}\n${c.bodyMd}`).join("\n\n");
  const tasks = detail.exercises.map((e) => `- ${e.title}: ${e.promptMd.split("\n")[0]}`).join("\n");
  return `<lesson title="${detail.lesson.title}" source="${detail.lesson.sourceUrl}">\n${text}\n</lesson>\n\n<exercises_the_learner_must_solve>\n${tasks || "(none)"}\n</exercises_the_learner_must_solve>`;
}


