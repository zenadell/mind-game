import { asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { askJson, stripCode } from "./ai";
import { NotFound, currentStreak, dayKey, markActive } from "./core";
import { award, mergeEvents, type GameEvent } from "./game";
import {
  EXERCISE_GRADE_SYSTEM,
  EXPLAIN_SOLUTION_SYSTEM,
  ExerciseGradeShape,
  HINT_SYSTEM,
  HintShape,
  TEACHBACK_SYSTEM,
  TeachbackShape,
} from "./prompts";
import { ensureSteps, lessonSources, passedSteps, type LessonSources } from "./steps";

export { NotFound, dayKey, markActive };

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
      tokensToday: sql<number>`coalesce(sum(case when ${schema.apiUsage.createdAt} >= ${startOfToday()} then ${schema.apiUsage.inputTokens} + ${schema.apiUsage.cacheReadTokens} + ${schema.apiUsage.outputTokens} end), 0)`,
    })
    .from(schema.apiUsage)
    .get()!;
  const completed = d.select().from(schema.progress).where(eq(schema.progress.status, "completed")).all().length;
  return { streak: currentStreak(), costTotal: cost.total, costToday: cost.today, tokensToday: cost.tokensToday, completed };
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

/** A quiz comes after every few lessons of a chapter (only where there is code to practise). */
export const QUIZ_EVERY = 3;
export type QuizBlock = { id: string; chapter: string; lessonIds: string[] };

export function quizBlocks(
  lessons: { id: string; chapter: string }[],
  exerciseCount: Map<string, number>,
): QuizBlock[] {
  const blocks: QuizBlock[] = [];
  let i = 0;
  while (i < lessons.length) {
    const chapter = lessons[i].chapter;
    const inChapter: string[] = [];
    while (i < lessons.length && lessons[i].chapter === chapter) inChapter.push(lessons[i++].id);
    for (let j = 0; j < inChapter.length; j += QUIZ_EVERY) {
      const ids = inChapter.slice(j, j + QUIZ_EVERY);
      if (ids.some((id) => (exerciseCount.get(id) ?? 0) > 0)) blocks.push({ id: `quiz-${ids[ids.length - 1]}`, chapter, lessonIds: ids });
    }
  }
  return blocks;
}

export function allQuizBlocks(): QuizBlock[] {
  const d = db();
  const lessons = d.select({ id: schema.lessons.id, chapter: schema.lessons.chapter }).from(schema.lessons).orderBy(asc(schema.lessons.ord)).all();
  const counts = new Map<string, number>();
  for (const e of d.select({ lessonId: schema.exercises.lessonId }).from(schema.exercises).all())
    counts.set(e.lessonId, (counts.get(e.lessonId) ?? 0) + 1);
  return quizBlocks(lessons, counts);
}

export type QuizStatus = "locked" | "available" | "passed";

export function lessonList() {
  const d = db();
  const lessons = d.select().from(schema.lessons).orderBy(asc(schema.lessons.ord)).all();
  const prog = new Map(d.select().from(schema.progress).all().map((p) => [p.lessonId, p]));
  const passed = new Set(d.select().from(schema.quizzes).where(eq(schema.quizzes.passed, true)).all().map((q) => q.blockId));
  const blockAfter = new Map(allQuizBlocks().map((b) => [b.lessonIds[b.lessonIds.length - 1], b]));
  let unlocked = true; // lessons unlock in order, and after each quiz is passed
  return lessons.map((l) => {
    const p = prog.get(l.id);
    const status = p?.status === "completed" ? "completed" : unlocked ? (p ? "started" : "available") : "locked";
    if (status !== "completed") unlocked = false;
    const block = blockAfter.get(l.id);
    let quizAfter: { id: string; status: QuizStatus } | null = null;
    if (block) {
      const allDone = block.lessonIds.every((id) => prog.get(id)?.status === "completed");
      const quizStatus: QuizStatus = passed.has(block.id) ? "passed" : allDone && unlocked ? "available" : "locked";
      if (quizStatus !== "passed") unlocked = false;
      quizAfter = { id: block.id, status: quizStatus };
    }
    return { ...l, status, mastery: p?.mastery ?? 0, quizAfter };
  });
}

export function isUnlocked(lessonId: string): boolean {
  return lessonList().find((l) => l.id === lessonId)?.status !== "locked";
}

export function lessonDetail(lessonId: string) {
  const d = db();
  const lesson = d.select().from(schema.lessons).where(eq(schema.lessons.id, lessonId)).get();
  if (!lesson) return null;
  const passed = passedSteps(lessonId);
  const steps = ensureSteps(lessonId).map((s) => ({
    id: s.id,
    title: s.title,
    sourceName: s.sourceName ?? "",
    sourceUrl: s.sourceUrl ?? "",
    bodyMd: s.bodyMd ?? "",
    passed: passed.has(s.id),
  }));
  const sources = lessonSources(lessonId);
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
    steps,
    odin: sources.odin
      .map((o) => ({ title: o.title, url: o.url }))
      .filter((o, i, all) => all.findIndex((x) => x.url === o.url) === i),
    goals: sources.goals,
    reading: sources.reading,
    exercises,
    teachbackPassed: teachback?.verdict === "understood",
    status: prog?.status ?? "available",
    chunkIndex: prog?.chunkIndex ?? 0,
    next: all[idx + 1] ?? null,
    quizAfter: all[idx]?.quizAfter ?? null,
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
export function tryComplete(lessonId: string): { completed: boolean; missing: string[]; game?: GameEvent | null } {
  const detail = lessonDetail(lessonId);
  if (!detail) return { completed: false, missing: ["lesson not found"] };
  const missing: string[] = [];
  if (!detail.steps.length) return { completed: false, missing: ["the lesson steps"] };
  const unchecked = detail.steps.filter((c) => !c.passed).length;
  if (unchecked) missing.push(`${unchecked} check question${unchecked > 1 ? "s" : ""}`);
  if (!detail.teachbackPassed) missing.push("the teach-back");
  const open = detail.exercises.filter((e) => !e.state.done).length;
  if (open) missing.push(`${open} exercise${open > 1 ? "s" : ""}`);
  if (missing.length) return { completed: false, missing };

  if (detail.status !== "completed") {
    // Mastery: share of checks right on the first try, and exercises solved without the solution.
    const d = db();
    let firstTry = 0;
    for (const st of detail.steps) {
      const first = d.select().from(schema.checks).where(eq(schema.checks.stepId, st.id)).orderBy(asc(schema.checks.id)).get();
      if (first?.verdict === "correct") firstTry++;
    }
    const own = detail.exercises.filter((e) => !e.state.solutionShown).length;
    const parts = [firstTry / Math.max(1, detail.steps.length)];
    if (detail.exercises.length) parts.push(own / detail.exercises.length);
    const mastery = parts.reduce((a, b) => a + b, 0) / parts.length;
    d.insert(schema.progress)
      .values({ lessonId, status: "completed", mastery, completedAt: Date.now() })
      .onConflictDoUpdate({
        target: schema.progress.lessonId,
        set: { status: "completed", mastery, completedAt: Date.now() },
      })
      .run();
    return { completed: true, missing: [], game: award("lesson", "Lesson complete!", { key: `lesson:${lessonId}` }) };
  }
  return { completed: true, missing: [] };
}

// ---------- Teaching steps ----------

export async function gradeTeachback(lessonId: string, text: string) {
  const detail = lessonDetail(lessonId);
  if (!detail) throw new NotFound("lesson");
  const summary = allSourceText(lessonSources(lessonId));
  const res = await askJson({
    purpose: "grade-teachback",
    role: "grader",
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
  const game = res.verdict === "understood" ? award("teachback", "You taught it back", { key: `teachback:${lessonId}` }) : null;
  return { ...res, game };
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
    role: "tutor",
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
      role: "grader",
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
  // First time solved: XP, plus a bonus when done without hints or the solution.
  const game =
    passed && !s.passed
      ? mergeEvents([
          award("exercise", "Exercise solved", { key: `exercise:${exerciseId}` }),
          s.hintsUsed === 0 && !s.solutionShown ? award("exerciseClean", "No hints!", { key: `exclean:${exerciseId}` }) : null,
        ])
      : null;
  return { passed, feedback, state: publicState(next), game };
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
    role: "grader",
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
  const text = allSourceText(lessonSources(lessonId));
  const tasks = detail.exercises.map((e) => `- ${e.title}: ${e.promptMd.split("\n")[0]}`).join("\n");
  return `<lesson title="${detail.lesson.title}" source="${detail.lesson.sourceUrl}">\n${text}\n</lesson>\n\n<exercises_the_learner_must_solve>\n${tasks || "(none)"}\n</exercises_the_learner_must_solve>`;
}



/** The whole lesson as the learner reads it: Odin sections, then javascript.info. */
function allSourceText(src: LessonSources): string {
  const odin = src.odin
    .flatMap((o) => o.sections.map((x) => `<odin_section lesson="${o.title}" title="${x.heading}">\n${x.body}\n</odin_section>`))
    .join("\n\n");
  return `${odin}\n\n<javascript_info>\n${src.jsinfo}\n</javascript_info>`;
}
