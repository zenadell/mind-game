import vm from "node:vm";
import { and, asc, eq, gt, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { askJson } from "./ai";
import { NotFound, markActive } from "./core";
import {
  CAN_REPLY,
  CHECK_SYSTEM,
  CheckShape,
  OUTLINE_SYSTEM,
  OutlineShape,
  REEXPLAIN_SYSTEM,
  ReexplainShape,
  STEP_SYSTEM,
  StepShape,
  type StepContent,
} from "./prompts";

// A lesson is taught as steps the tutor plans from javascript.info + The Odin Project.
// The plan is made once per lesson; each step's content is written the first time it
// is opened (or prefetched), then saved, so it costs nothing to revisit.

export type LessonSources = {
  title: string;
  jsinfoUrl: string;
  jsinfo: string;
  odin: { title: string; url: string; body: string }[];
};

export function lessonSources(lessonId: string): LessonSources {
  const d = db();
  const lesson = d.select().from(schema.lessons).where(eq(schema.lessons.id, lessonId)).get();
  if (!lesson) throw new NotFound("lesson");
  const chunks = d.select().from(schema.chunks).where(eq(schema.chunks.lessonId, lessonId)).orderBy(asc(schema.chunks.ord)).all();
  const odin = d
    .select({ title: schema.odinLessons.title, url: schema.odinLessons.url, body: schema.odinLessons.bodyMd })
    .from(schema.lessonOdin)
    .innerJoin(schema.odinLessons, eq(schema.lessonOdin.odinPath, schema.odinLessons.path))
    .where(eq(schema.lessonOdin.lessonId, lessonId))
    .all();
  return {
    title: lesson.title,
    jsinfoUrl: lesson.sourceUrl,
    jsinfo: chunks.map((c) => `## ${c.heading}\n${c.bodyMd}`).join("\n\n"),
    odin,
  };
}

function sourcesText(s: LessonSources): string {
  const odin = s.odin.length
    ? s.odin.map((o) => `<odin_lesson title="${o.title}">\n${o.body}\n</odin_lesson>`).join("\n\n")
    : "(no matching Odin Project lesson; use javascript.info and your own beginner-friendly background)";
  return `<javascript_info_lesson title="${s.title}">\n${s.jsinfo}\n</javascript_info_lesson>\n\n${odin}`;
}

/** Titles of lessons before this one: what the learner has already been taught. */
function earlierLessons(lessonId: string): string[] {
  const d = db();
  const l = d.select().from(schema.lessons).where(eq(schema.lessons.id, lessonId)).get();
  if (!l) return [];
  return d
    .select({ title: schema.lessons.title })
    .from(schema.lessons)
    .where(lt(schema.lessons.ord, l.ord))
    .orderBy(asc(schema.lessons.ord))
    .all()
    .map((x) => x.title);
}

/** Titles of the next lessons: topics this lesson must leave for later. */
function laterLessons(lessonId: string, count = 25): string[] {
  const d = db();
  const l = d.select().from(schema.lessons).where(eq(schema.lessons.id, lessonId)).get();
  if (!l) return [];
  return d
    .select({ title: schema.lessons.title })
    .from(schema.lessons)
    .where(gt(schema.lessons.ord, l.ord))
    .orderBy(asc(schema.lessons.ord))
    .limit(count)
    .all()
    .map((x) => x.title);
}

export function lessonSteps(lessonId: string) {
  return db().select().from(schema.steps).where(eq(schema.steps.lessonId, lessonId)).orderBy(asc(schema.steps.ord)).all();
}

// One generation at a time per key, so a prefetch and a click don't pay twice.
const pending = new Map<string, Promise<unknown>>();
function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const running = pending.get(key) as Promise<T> | undefined;
  if (running) return running;
  const p = fn().finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}

/** Make (once) the lesson's step plan from both sources. */
export function planLesson(lessonId: string) {
  const existing = lessonSteps(lessonId);
  if (existing.length) return Promise.resolve(existing);
  return once(`plan:${lessonId}`, async () => {
    const src = lessonSources(lessonId);
    const earlier = earlierLessons(lessonId);
    const res = await askJson({
      purpose: "plan-lesson",
      role: "tutor",
      system: OUTLINE_SYSTEM,
      prompt: [
        sourcesText(src),
        `Lessons the learner has ALREADY learned (in order): ${earlier.length ? earlier.join("; ") : "none, this is their very first lesson"}.`,
        `Lessons that come AFTER this one, each teaching its own topic: ${laterLessons(lessonId).join("; ") || "none"}. Do NOT plan steps for those topics, even if the Odin text covers them; at most mention them in one sentence as coming later.`,
        `Plan the steps for "${src.title}".`,
      ].join("\n\n"),
      shape: OutlineShape,
      maxTokens: 32000,
    });
    const now = Date.now();
    const d = db();
    d.transaction((tx) => {
      if (tx.select().from(schema.steps).where(eq(schema.steps.lessonId, lessonId)).get()) return;
      res.steps.slice(0, 12).forEach((s, i) =>
        tx.insert(schema.steps).values({ lessonId, ord: i, title: s.title, goal: s.goal, createdAt: now }).run(),
      );
    });
    return lessonSteps(lessonId);
  });
}

/** Run a JavaScript example the tutor wrote. Returns its printed output, or the error. */
export function runExample(code: string): { ok: boolean; output: string } {
  const lines: string[] = [];
  const fmt = (v: unknown) => (typeof v === "string" ? v : typeof v === "object" && v !== null ? JSON.stringify(v) : String(v));
  const out = (...a: unknown[]) => lines.push(a.map(fmt).join(" "));
  try {
    vm.runInNewContext(code, { console: { log: out, info: out, warn: out, error: out }, alert: out }, { timeout: 500 });
    return { ok: true, output: lines.join("\n") };
  } catch (e) {
    return { ok: false, output: `${(e as Error).name}: ${(e as Error).message}` };
  }
}

export function exampleCode(c: StepContent): string {
  return c.example.lines.map((l) => l.code).join("\n");
}

/** The deep content of one step: written once, checked, saved. */
export function stepContent(stepId: number): Promise<StepContent> {
  const d = db();
  const step = d.select().from(schema.steps).where(eq(schema.steps.id, stepId)).get();
  if (!step) throw new NotFound("step");
  if (step.contentJson) return Promise.resolve(StepShape.parse(JSON.parse(step.contentJson)));
  return once(`step:${stepId}`, async () => {
    const src = lessonSources(step.lessonId);
    const all = lessonSteps(step.lessonId);
    const before = all.filter((s) => s.ord < step.ord).map((s) => `${s.title}: ${s.goal}`);
    const after = all.filter((s) => s.ord > step.ord).map((s) => s.title);
    const prompt = [
      sourcesText(src),
      `Already learned in earlier lessons: ${earlierLessons(step.lessonId).join("; ") || "nothing yet"}.`,
      `Taught in LATER lessons (don't teach these here): ${laterLessons(step.lessonId, 15).join("; ") || "nothing"}.`,
      `Already learned in earlier steps of this lesson:\n${before.map((b) => `- ${b}`).join("\n") || "- nothing yet (this is the first step)"}`,
      `Coming in later steps (don't teach these yet): ${after.join("; ") || "nothing"}.`,
      `Write step ${step.ord + 1} of ${all.length}: "${step.title}". Goal: ${step.goal}`,
    ].join("\n\n");

    let content: StepContent | null = null;
    let feedback = "";
    for (let attempt = 0; attempt < 2 && !content; attempt++) {
      const c = await askJson({
        purpose: "write-step",
        role: "tutor",
        system: STEP_SYSTEM,
        prompt: prompt + feedback,
        shape: StepShape,
        maxTokens: 32000,
      });
      if (c.example.language !== "javascript") {
        content = c;
        break;
      }
      // Make sure the example really runs, and show what it really prints.
      const run = runExample(exampleCode(c));
      if (run.ok) content = { ...c, output: run.output || c.output };
      else feedback = `\n\nYour previous example failed when run (${run.output}). Write a JavaScript example that runs on its own in a console.`;
      if (!content && attempt === 1) content = { ...c, example: { language: "none", lines: [] }, output: "" };
    }
    d.update(schema.steps).set({ contentJson: JSON.stringify(content) }).where(eq(schema.steps.id, stepId)).run();
    return content!;
  });
}

/** After two wrong answers: explain the step again, differently. Not saved. */
export async function reexplainStep(stepId: number, wrongAnswers: string[]) {
  const content = await stepContent(stepId);
  const step = db().select().from(schema.steps).where(eq(schema.steps.id, stepId)).get()!;
  return askJson({
    purpose: "re-explain",
    role: "tutor",
    system: REEXPLAIN_SYSTEM,
    prompt: `Step: "${step.title}" (goal: ${step.goal})\n\nThe explanation they read:\n${content.explanation.join("\n")}\nAnalogy: ${content.analogy}\n\nQuestion: ${content.question}\nTheir wrong answers: ${wrongAnswers.join(" | ")}`,
    shape: ReexplainShape,
    maxTokens: 6000,
  });
}

/** Text the grader and reviews use for a step. */
export function stepContext(title: string, c: StepContent): string {
  return [
    `Step: ${title}`,
    c.why,
    ...c.explanation,
    c.example.lines.length ? "Example:\n" + exampleCode(c) : "",
    c.new_words.map((w) => `${w.word}: ${w.meaning}`).join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export type Turn = { who: "learner" | "tutor"; text: string };

/** Grade an answer to a step's check. `history` holds earlier tries and feedback, so a reply
 *  to the tutor's follow-up question is judged in context. */
export async function gradeStepCheck(stepId: number, question: string, answerKey: string, answer: string, history: Turn[] = []) {
  const step = db().select().from(schema.steps).where(eq(schema.steps.id, stepId)).get();
  if (!step) throw new NotFound("step");
  const content = await stepContent(stepId);
  const res = await askJson({
    purpose: "grade-check",
    role: "grader",
    system: CHECK_SYSTEM,
    prompt: [
      `<lesson_piece>\n${stepContext(step.title, content)}\n</lesson_piece>`,
      `Question: ${question}\nAnswer key: ${answerKey}`,
      history.length ? `Conversation so far:\n${history.map((t) => `${t.who === "learner" ? "Learner" : "You (tutor)"}: ${t.text}`).join("\n")}` : "",
      `Learner answer: ${answer}`,
      CAN_REPLY,
    ]
      .filter(Boolean)
      .join("\n\n"),
    shape: CheckShape,
    maxTokens: 1500,
  });
  db()
    .insert(schema.checks)
    .values({ chunkId: 0, stepId, question, answer, verdict: res.verdict, feedback: res.feedback, createdAt: Date.now() })
    .run();
  markActive();
  return { ...res, lessonId: step.lessonId, context: stepContext(step.title, content) };
}

/** Step ids with a correct check. */
export function passedSteps(lessonId: string): Set<number> {
  const ids = lessonSteps(lessonId).map((s) => s.id);
  if (!ids.length) return new Set();
  const rows = db()
    .select({ stepId: schema.checks.stepId })
    .from(schema.checks)
    .where(and(eq(schema.checks.verdict, "correct")))
    .all();
  const set = new Set(ids);
  return new Set(rows.map((r) => r.stepId).filter((x): x is number => x != null && set.has(x)));
}
