import { and, asc, eq, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { askJson } from "./ai";
import { dayKey, markActive } from "./core";
import { CANNOT_REPLY, CHECK_SYSTEM, CheckShape } from "./prompts";

// Spaced repetition: anything answered wrong comes back after 1 day, then 3, then 7.
// A wrong answer during review starts the item again from 1 day.
export const INTERVALS = [1, 3, 7];

export function addDays(day: string, n: number): string {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** After a review answer: the next stage and due day, or done. */
export function nextSchedule(stage: number, correct: boolean, today: string) {
  if (!correct) return { stage: 0, dueDay: addDays(today, INTERVALS[0]), done: false };
  const next = stage + 1;
  if (next >= INTERVALS.length) return { stage: next, dueDay: today, done: true };
  return { stage: next, dueDay: addDays(today, INTERVALS[next]), done: false };
}

type NewReview = {
  lessonId: string;
  source: "check" | "quiz";
  sourceKey: string;
  kind: "short" | "choice";
  question: string;
  code?: string | null;
  options?: string[];
  answerKey: string;
  context: string;
};

/** Schedule an item for tomorrow, unless it is already waiting in the queue. */
export function scheduleReview(r: NewReview) {
  const d = db();
  const active = d
    .select()
    .from(schema.reviews)
    .where(and(eq(schema.reviews.sourceKey, r.sourceKey), eq(schema.reviews.done, false)))
    .get();
  if (active) return active.id;
  return d
    .insert(schema.reviews)
    .values({
      lessonId: r.lessonId,
      source: r.source,
      sourceKey: r.sourceKey,
      kind: r.kind,
      question: r.question,
      code: r.code ?? null,
      optionsJson: r.options ? JSON.stringify(r.options) : null,
      answerKey: r.answerKey,
      context: r.context.slice(0, 4000),
      stage: 0,
      dueDay: addDays(dayKey(), INTERVALS[0]),
      createdAt: Date.now(),
    })
    .returning({ id: schema.reviews.id })
    .get().id;
}

/** Review cards due today or earlier (what the browser sees: no answer keys). */
export function dueReviews(today = dayKey()) {
  const titles = new Map(db().select({ id: schema.lessons.id, title: schema.lessons.title }).from(schema.lessons).all().map((l) => [l.id, l.title]));
  return db()
    .select()
    .from(schema.reviews)
    .where(and(eq(schema.reviews.done, false), lte(schema.reviews.dueDay, today)))
    .orderBy(asc(schema.reviews.dueDay), asc(schema.reviews.id))
    .all()
    .map((r) => ({
      id: r.id,
      lessonId: r.lessonId,
      lessonTitle: titles.get(r.lessonId) ?? r.lessonId,
      kind: r.kind as "short" | "choice",
      question: r.question,
      code: r.code,
      options: r.optionsJson ? (JSON.parse(r.optionsJson) as string[]) : null,
      stage: r.stage,
    }));
}

export function reviewCounts(today = dayKey()) {
  const all = db().select().from(schema.reviews).where(eq(schema.reviews.done, false)).all();
  return {
    due: all.filter((r) => r.dueDay <= today).length,
    upcoming: all.filter((r) => r.dueDay > today).length,
    nextDay: all.filter((r) => r.dueDay > today).map((r) => r.dueDay).sort()[0] ?? null,
  };
}

/** Grade a review answer and reschedule it. */
export async function answerReview(id: number, answer: string) {
  const d = db();
  const r = d.select().from(schema.reviews).where(eq(schema.reviews.id, id)).get();
  if (!r) throw new Error("review not found");
  let correct: boolean;
  let feedback: string;
  if (r.kind === "choice") {
    const options = JSON.parse(r.optionsJson ?? "[]") as string[];
    correct = answer === r.answerKey;
    feedback = correct ? "Right!" : `The right answer was: ${options[Number(r.answerKey)] ?? "?"}`;
  } else {
    const res = await askJson({
      purpose: "grade-review",
      role: "grader",
      system: CHECK_SYSTEM,
      prompt: `<lesson_piece>\n${r.context}\n</lesson_piece>\n\nQuestion: ${r.question}${r.code ? `\n\`\`\`js\n${r.code}\n\`\`\`` : ""}\nAnswer key: ${r.answerKey}\n\nLearner answer: ${answer}\n\n${CANNOT_REPLY}`,
      shape: CheckShape,
      maxTokens: 1500,
    });
    correct = res.verdict === "correct";
    feedback = res.feedback;
  }
  const today = dayKey();
  const next = nextSchedule(r.stage, correct, today);
  d.update(schema.reviews).set(next).where(eq(schema.reviews.id, id)).run();
  d.insert(schema.reviewLog).values({ reviewId: id, answer, correct, createdAt: Date.now() }).run();
  markActive();
  return { correct, feedback, done: next.done, nextDay: next.done ? null : next.dueDay };
}
