import vm from "node:vm";
import { and, asc, eq, gt, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { askJson } from "./ai";
import { NotFound, markActive } from "./core";
import { odinTitle, odinUrl, parseSpec, splitOdin } from "./odin";
import {
  CAN_REPLY,
  CHECK_SYSTEM,
  CODE_EXPLAIN_SYSTEM,
  CheckShape,
  CodeExplainShape,
  REEXPLAIN_SYSTEM,
  ReexplainShape,
  SECTION_HELP_SYSTEM,
  STEP_SYSTEM,
  SectionHelpShape,
  StepShape,
  type CodeExplain,
  type SectionHelp,
  type StepContent,
} from "./prompts";

// A lesson is the ORIGINAL text, split into sections: first the matching Odin Project
// sections (beginner context), then javascript.info (depth). The tutor helps around each
// section: words to know, line-by-line code explanations, a recap, a check question, and
// (if needed) a from-zero explanation. Every piece of help is written once and saved.

export type OdinSource = { title: string; url: string; heading: string | null; sections: { heading: string; body: string }[] };

export type LessonSources = {
  title: string;
  jsinfoUrl: string;
  jsinfo: string;
  odin: OdinSource[];
  goals: string[];
  reading: { text: string; url: string }[];
};

export function lessonSources(lessonId: string): LessonSources {
  const d = db();
  const lesson = d.select().from(schema.lessons).where(eq(schema.lessons.id, lessonId)).get();
  if (!lesson) throw new NotFound("lesson");
  const chunks = d.select().from(schema.chunks).where(eq(schema.chunks.lessonId, lessonId)).orderBy(asc(schema.chunks.ord)).all();
  const specs = d.select().from(schema.lessonOdin).where(eq(schema.lessonOdin.lessonId, lessonId)).all();
  const odin: OdinSource[] = [];
  const goals: string[] = [];
  const reading: { text: string; url: string }[] = [];
  for (const { odinPath: spec } of specs) {
    const { path, heading } = parseSpec(spec);
    const file = d.select().from(schema.odinLessons).where(eq(schema.odinLessons.path, path)).get();
    if (!file) continue;
    const parts = splitOdin(file.bodyMd);
    const sections = heading ? parts.sections.filter((s) => s.heading === heading) : parts.sections;
    odin.push({ title: odinTitle(path), url: odinUrl(path), heading, sections });
    if (!heading) {
      // A whole Odin lesson belongs here: use its goals and reading list too.
      goals.push(...parts.goals);
      for (const r of parts.reading) if (!reading.some((x) => x.url === r.url)) reading.push(r);
    }
  }
  return {
    title: lesson.title,
    jsinfoUrl: lesson.sourceUrl,
    jsinfo: chunks.map((c) => `## ${c.heading}\n${c.bodyMd}`).join("\n\n"),
    odin,
    goals,
    reading,
  };
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
function laterLessons(lessonId: string, count = 15): string[] {
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

/**
 * The lesson's steps: one per section of the original text. Built instantly (no AI) the
 * first time. Lessons planned the older way (AI-rewritten steps) are rebuilt.
 */
export function ensureSteps(lessonId: string) {
  const existing = lessonSteps(lessonId);
  if (existing.length && existing.every((s) => s.kind === "source")) return existing;
  const src = lessonSources(lessonId);
  const d = db();
  const now = Date.now();
  const rows: (typeof schema.steps.$inferInsert)[] = [];
  for (const o of src.odin)
    for (const s of o.sections)
      rows.push({
        lessonId,
        ord: 0,
        // Every Odin lesson starts with "Introduction"; name it after its lesson instead.
        title: /^introduction$/i.test(s.heading) ? o.title : s.heading,
        goal: "",
        kind: "source",
        sourceName: "The Odin Project",
        sourceUrl: o.url,
        bodyMd: s.body,
        createdAt: now,
      });
  const chunks = d.select().from(schema.chunks).where(eq(schema.chunks.lessonId, lessonId)).orderBy(asc(schema.chunks.ord)).all();
  for (const c of chunks)
    rows.push({ lessonId, ord: 0, title: c.heading, goal: "", kind: "source", sourceName: "javascript.info", sourceUrl: src.jsinfoUrl, bodyMd: c.bodyMd, createdAt: now });
  d.transaction((tx) => {
    tx.delete(schema.steps).where(eq(schema.steps.lessonId, lessonId)).run();
    rows.forEach((r, i) => tx.insert(schema.steps).values({ ...r, ord: i }).run());
  });
  return lessonSteps(lessonId);
}

/** Kept for the /plan route: building steps is now instant. */
export async function planLesson(lessonId: string) {
  return ensureSteps(lessonId);
}

function stepRow(stepId: number) {
  const step = db().select().from(schema.steps).where(eq(schema.steps.id, stepId)).get();
  if (!step) throw new NotFound("step");
  return step;
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

/** Read a saved piece of help, or make it once and save it. */
function cached<T>(stepId: number, key: string, parse: (json: unknown) => T, make: () => Promise<T>): Promise<T> {
  const row = db()
    .select()
    .from(schema.stepCache)
    .where(and(eq(schema.stepCache.stepId, stepId), eq(schema.stepCache.key, key)))
    .get();
  if (row) return Promise.resolve(parse(JSON.parse(row.json)));
  return once(`${stepId}:${key}`, async () => {
    const value = await make();
    db()
      .insert(schema.stepCache)
      .values({ stepId, key, json: JSON.stringify(value) })
      .onConflictDoUpdate({ target: [schema.stepCache.stepId, schema.stepCache.key], set: { json: JSON.stringify(value) } })
      .run();
    return value;
  });
}

/** What the learner already knows when reaching this step. */
function knownBefore(step: typeof schema.steps.$inferSelect): string {
  const earlier = lessonSteps(step.lessonId).filter((s) => s.ord < step.ord).map((s) => s.title);
  return [
    `Lessons already learned: ${earlierLessons(step.lessonId).join("; ") || "none, this is the very first lesson"}.`,
    `Sections already read in this lesson: ${earlier.join("; ") || "none, this is the first section"}.`,
    `Taught in LATER lessons: ${laterLessons(step.lessonId).join("; ") || "nothing"}.`,
  ].join("\n");
}

function sectionText(step: typeof schema.steps.$inferSelect): string {
  return `<section source="${step.sourceName}" lesson="${step.lessonId}" title="${step.title}">\n${step.bodyMd ?? ""}\n</section>`;
}

/** Before/after help for one section: words to know, what it's about, recap, check question. */
export function sectionHelp(stepId: number): Promise<SectionHelp> {
  const step = stepRow(stepId);
  return cached(stepId, "help", (j) => SectionHelpShape.parse(j), () =>
    askJson({
      purpose: "section-help",
      role: "tutor",
      system: SECTION_HELP_SYSTEM,
      prompt: `${knownBefore(step)}\n\n${sectionText(step)}`,
      shape: SectionHelpShape,
      maxTokens: 16000,
    }),
  );
}

/** Code blocks in a section's Markdown, in order (including ones inside > quotes). */
export function codeBlocks(md: string): { lang: string; code: string }[] {
  const out: { lang: string; code: string }[] = [];
  let open: { lang: string; lines: string[] } | null = null;
  for (const raw of md.split("\n")) {
    const line = raw.replace(/^(> ?)+/, "");
    const fence = line.match(/^```(\w*)/);
    if (fence && !open) {
      open = { lang: fence[1] || "", lines: [] };
      continue;
    }
    if (open && /^```\s*$/.test(line)) {
      out.push({ lang: open.lang, code: open.lines.join("\n") });
      open = null;
      continue;
    }
    if (open) open.lines.push(line);
  }
  return out;
}

/** Line-by-line explanation of the n-th code example in a section. */
export function explainCode(stepId: number, index: number): Promise<CodeExplain> {
  const step = stepRow(stepId);
  const block = codeBlocks(step.bodyMd ?? "")[index];
  if (!block) throw new NotFound("code example");
  return cached(stepId, `code:${index}`, (j) => CodeExplainShape.parse(j), () =>
    askJson({
      purpose: "explain-code",
      role: "tutor",
      system: CODE_EXPLAIN_SYSTEM,
      prompt: `${knownBefore(step)}\n\nThe section it comes from:\n${sectionText(step)}\n\nExplain this example (${block.lang || "code"}):\n\`\`\`\n${block.code}\n\`\`\``,
      shape: CodeExplainShape,
      maxTokens: 16000,
    }),
  );
}

/** Run a JavaScript example. Returns its printed output, or the error. */
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

/** "Teach me this from zero": the tutor's own full explanation of the section. */
export function deepSection(stepId: number): Promise<StepContent> {
  const step = stepRow(stepId);
  return cached(stepId, "deep", (j) => StepShape.parse(j), async () => {
    const prompt = `${knownBefore(step)}\n\nThe learner read this section of the real lesson and wants it taught again from zero, completely:\n${sectionText(step)}\n\nTeach exactly what this section teaches (all of it), as one step titled "${step.title}".`;
    let feedback = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const c = await askJson({ purpose: "teach-from-zero", role: "tutor", system: STEP_SYSTEM, prompt: prompt + feedback, shape: StepShape, maxTokens: 32000 });
      if (c.example.language !== "javascript") return c;
      // Make sure the tutor's example really runs, and show what it really prints.
      const run = runExample(exampleCode(c));
      if (run.ok) return { ...c, output: run.output || c.output };
      feedback = `\n\nYour previous example failed when run (${run.output}). Write a JavaScript example that runs on its own in a console.`;
      if (attempt === 1) return { ...c, example: { language: "none" as const, lines: [] }, output: "" };
    }
    throw new Error("unreachable");
  });
}

/** After several misses: explain the section again, differently, with a new question. Not saved. */
export async function reexplainStep(stepId: number, wrongAnswers: string[]) {
  const step = stepRow(stepId);
  const help = await sectionHelp(stepId);
  return askJson({
    purpose: "re-explain",
    role: "tutor",
    system: REEXPLAIN_SYSTEM,
    prompt: `${sectionText(step)}\n\nQuestion: ${help.question}\nTheir wrong answers: ${wrongAnswers.join(" | ")}`,
    shape: ReexplainShape,
    maxTokens: 16000,
  });
}

/** Text the grader and reviews use for a step. */
export function stepContext(step: typeof schema.steps.$inferSelect): string {
  return `Section "${step.title}" (${step.sourceName}):\n${(step.bodyMd ?? "").slice(0, 6000)}`;
}

export type Turn = { who: "learner" | "tutor"; text: string };

/** Grade an answer to a step's check. `history` holds earlier tries and feedback, so a reply
 *  to the tutor's follow-up question is judged in context. */
export async function gradeStepCheck(stepId: number, question: string, answerKey: string, answer: string, history: Turn[] = []) {
  const step = stepRow(stepId);
  const res = await askJson({
    purpose: "grade-check",
    role: "grader",
    system: CHECK_SYSTEM,
    prompt: [
      `<lesson_piece>\n${stepContext(step)}\n</lesson_piece>`,
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
  return { ...res, lessonId: step.lessonId, context: stepContext(step) };
}

/** Step ids with a correct check. */
export function passedSteps(lessonId: string): Set<number> {
  const ids = new Set(lessonSteps(lessonId).map((s) => s.id));
  if (!ids.size) return new Set();
  const rows = db().select({ stepId: schema.checks.stepId }).from(schema.checks).where(eq(schema.checks.verdict, "correct")).all();
  return new Set(rows.map((r) => r.stepId).filter((x): x is number => x != null && ids.has(x)));
}
