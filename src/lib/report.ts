import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { dayKey, stats } from "./learning";
import { addDays } from "./review";

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });

/** The last 7 days: what was done each day, how well, and the weakest topics to redo. */
export function weeklyReport(today = dayKey()) {
  const d = db();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const inWeek = (t: number | null | undefined) => t != null && days.includes(dayKey(t));
  const perDay = new Map(days.map((k) => [k, 0]));
  const bump = (t: number) => {
    const k = dayKey(t);
    if (perDay.has(k)) perDay.set(k, perDay.get(k)! + 1);
  };

  const lessons = new Map(d.select().from(schema.lessons).all().map((l) => [l.id, l]));
  const chunkLesson = new Map(d.select({ id: schema.chunks.id, lessonId: schema.chunks.lessonId }).from(schema.chunks).all().map((c) => [c.id, c.lessonId]));

  // Check questions: first try per step decides "right first time".
  const checks = d.select().from(schema.checks).all();
  const firstByChunk = new Map<number, (typeof checks)[number]>();
  for (const c of checks) if (!firstByChunk.has(c.chunkId)) firstByChunk.set(c.chunkId, c);
  const weekChecks = checks.filter((c) => inWeek(c.createdAt));
  weekChecks.forEach((c) => bump(c.createdAt));
  const firstTries = [...firstByChunk.values()].filter((c) => inWeek(c.createdAt));
  const wrongByLesson = new Map<string, number>();
  for (const c of weekChecks) {
    if (c.verdict === "correct") continue;
    const id = chunkLesson.get(c.chunkId);
    if (id) wrongByLesson.set(id, (wrongByLesson.get(id) ?? 0) + 1);
  }

  const attempts = d.select().from(schema.attempts).all().filter((a) => inWeek(a.createdAt));
  attempts.forEach((a) => bump(a.createdAt));
  const solved = new Set(attempts.filter((a) => a.passed).map((a) => a.exerciseId));

  const reviewLog = d.select().from(schema.reviewLog).all().filter((r) => inWeek(r.createdAt));
  reviewLog.forEach((r) => bump(r.createdAt));

  const teachbacks = d.select().from(schema.teachbacks).all().filter((t) => inWeek(t.createdAt));
  teachbacks.forEach((t) => bump(t.createdAt));

  const quizzes = d.select().from(schema.quizzes).all().filter((q) => inWeek(q.finishedAt));
  const blockTitles = (blockId: string) => {
    const last = blockId.replace(/^quiz-/, "");
    const l = lessons.get(last);
    return l ? `up to “${l.title}”` : "";
  };
  quizzes.forEach((q) => bump(q.finishedAt!));

  const completed = d.select().from(schema.progress).where(eq(schema.progress.status, "completed")).all();
  const completedThisWeek = completed.filter((p) => inWeek(p.completedAt));

  // Weakest topics: lowest mastery among finished lessons, plus where checks went wrong this week.
  const score = new Map<string, number>();
  for (const p of completed) score.set(p.lessonId, p.mastery);
  for (const [id, n] of wrongByLesson) score.set(id, Math.min(score.get(id) ?? 1, 1 - Math.min(n, 5) / 5));
  const weakest = [...score]
    .filter(([id, s]) => s < 0.85 && lessons.has(id))
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([id, s]) => ({
      id,
      title: lessons.get(id)!.title,
      mastery: s,
      wrongChecks: wrongByLesson.get(id) ?? 0,
    }));

  const usage = d.select().from(schema.apiUsage).all().filter((u) => inWeek(u.createdAt));
  const s = stats();
  return {
    from: days[0],
    to: today,
    days: days.map((k) => ({ day: k, label: WEEKDAY.format(new Date(k + "T12:00:00Z")), actions: perDay.get(k)! })),
    activeDays: days.filter((k) => perDay.get(k)! > 0).length,
    streak: s.streak,
    lessonsCompleted: completedThisWeek.map((p) => ({ id: p.lessonId, title: lessons.get(p.lessonId)?.title ?? p.lessonId, mastery: p.mastery })),
    checks: { answered: weekChecks.length, firstTry: firstTries.length, firstTryRight: firstTries.filter((c) => c.verdict === "correct").length },
    exercisesSolved: solved.size,
    reviews: { done: reviewLog.length, right: reviewLog.filter((r) => r.correct).length },
    quizzes: quizzes.map((q) => ({ blockId: q.blockId, label: blockTitles(q.blockId), score: q.score ?? 0, passed: q.passed })),
    teachbacks: { done: teachbacks.length, understood: teachbacks.filter((t) => t.verdict === "understood").length },
    weakest,
    cost: usage.reduce((a, u) => a + u.costUsd, 0),
    tokens: usage.reduce((a, u) => a + u.inputTokens + u.cacheReadTokens + u.outputTokens, 0),
  };
}

export type WeeklyReport = ReturnType<typeof weeklyReport>;
