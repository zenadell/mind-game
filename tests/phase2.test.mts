import { test } from "node:test";
import assert from "node:assert/strict";

process.env.CODETUTOR_DB = ":memory:";
process.env.CODETUTOR_FAKE_AI = "1";
const R = await import("../src/lib/review");
const Q = await import("../src/lib/quiz");
const L = await import("../src/lib/learning");
const { weeklyReport } = await import("../src/lib/report");
const { db, schema } = await import("../src/db");

test("review schedule: 1, 3, 7 days; a miss starts again", () => {
  assert.deepEqual(R.nextSchedule(0, true, "2026-10-14"), { stage: 1, dueDay: "2026-10-17", done: false });
  assert.deepEqual(R.nextSchedule(1, true, "2026-10-14"), { stage: 2, dueDay: "2026-10-21", done: false });
  assert.equal(R.nextSchedule(2, true, "2026-10-14").done, true);
  assert.deepEqual(R.nextSchedule(2, false, "2026-10-14"), { stage: 0, dueDay: "2026-10-15", done: false });
});

test("a wrong check is queued once, due tomorrow, and graded on review", async () => {
  const d = db();
  d.insert(schema.lessons).values({ id: "v", source: "s", sourceUrl: "u", path: "p", title: "Variables", chapter: "C", semester: 1, ord: 1 }).run();
  const c = d.insert(schema.chunks).values({ lessonId: "v", ord: 0, heading: "h", bodyMd: "let stores values" }).returning().get();
  R.scheduleFromCheck(c.id, "What does let do?", "declares a variable");
  R.scheduleFromCheck(c.id, "What does let do?", "declares a variable");
  assert.equal(d.select().from(schema.reviews).all().length, 1);
  assert.equal(R.dueReviews(L.dayKey()).length, 0); // not today
  const tomorrow = R.addDays(L.dayKey(), 1);
  const due = R.dueReviews(tomorrow);
  assert.equal(due.length, 1);
  assert.equal(JSON.stringify(due).includes("declares a variable"), false); // no answer key to the browser
  const r = await R.answerReview(due[0].id, "it stores values because ...");
  assert.equal(r.correct, true);
  assert.equal(r.nextDay, R.addDays(L.dayKey(), 3));
});

test("quiz questions are checked by running their code", () => {
  const base = { type: "choice" as const, question: "What does this print?", answer_key: "", explain: "", lesson: "v" };
  const qs = Q.verifyQuestions([
    { ...base, code: "let a = 2;\nconsole.log(a + '1');", options: ["3", "21", "error", "undefined"], correct_index: 0 }, // AI was wrong: fixed to "21"
    { ...base, code: "console.log(1 + 1)", options: ["3", "4", "5", "6"], correct_index: 0 }, // no matching option: dropped
    { ...base, code: "while (true) console.log(1)", options: ["1", "b"], correct_index: 0 }, // never ends: dropped
    { ...base, code: "", options: ["let", "const"], correct_index: 1 },
    { type: "short", question: "Why?", code: "", options: ["x"], correct_index: 3, answer_key: "because", explain: "", lesson: "v" },
  ]);
  assert.equal(qs.length, 3);
  assert.equal(qs[0].correct_index, 1);
  assert.deepEqual([qs[2].options, qs[2].correct_index], [[], -1]);
});

test("quiz blocks: every 3 lessons per chapter, skipping chapters with no exercises", () => {
  const ls = ["a", "b", "c", "d", "e"].map((id) => ({ id, chapter: "JS" })).concat([{ id: "intro", chapter: "Intro" }]);
  const blocks = L.quizBlocks(ls, new Map([["a", 1], ["e", 2]]));
  assert.deepEqual(blocks.map((b) => [b.id, b.lessonIds]), [["quiz-c", ["a", "b", "c"]], ["quiz-e", ["d", "e"]]]);
});

test("the next lesson waits for the quiz", () => {
  const d = db();
  d.delete(schema.lessons).run();
  for (const [i, id] of ["a", "b", "c", "d"].entries())
    d.insert(schema.lessons).values({ id, source: "s", sourceUrl: "u", path: "p", title: id, chapter: "JS", semester: 1, ord: i }).run();
  d.insert(schema.exercises).values({ id: "x", lessonId: "a", ord: 0, title: "t", sourceUrl: "u", importance: 3, promptMd: "", starterCode: "", solutionHidden: "" }).run();
  for (const id of ["a", "b", "c"]) d.insert(schema.progress).values({ lessonId: id, status: "completed" }).run();
  let list = L.lessonList();
  assert.deepEqual([list[2].quizAfter, list[3].status], [{ id: "quiz-c", status: "available" }, "locked"]);
  d.insert(schema.quizzes).values({ blockId: "quiz-c", questionsJson: "[]", passed: true, score: 1, createdAt: 1, finishedAt: 1 }).run();
  list = L.lessonList();
  assert.deepEqual([list[2].quizAfter?.status, list[3].status], ["passed", "available"]);
});

test("weekly report counts this week's work", () => {
  const r = weeklyReport();
  assert.equal(r.days.length, 7);
  assert.equal(r.reviews.done, 1);
  assert.equal(r.days.at(-1)!.actions >= 1, true);
});
