import { test } from "node:test";
import assert from "node:assert/strict";

process.env.CODETUTOR_DB = ":memory:";
const L = await import("../src/lib/learning");
const { db, schema } = await import("../src/db");

const base = {
  exerciseId: "x",
  hintsUsed: 0,
  failedAttempts: 0,
  solutionShown: false,
  passed: false,
  retypePassed: false,
  explainPassed: false,
};

test("hint ladder: each new hint needs a failed try first", () => {
  assert.equal(L.canTakeHint(base).ok, true);
  assert.equal(L.canTakeHint({ ...base, hintsUsed: 1 }).ok, false);
  assert.equal(L.canTakeHint({ ...base, hintsUsed: 1, failedAttempts: 1 }).ok, true);
  assert.equal(L.canTakeHint({ ...base, hintsUsed: 3, failedAttempts: 5 }).ok, false);
});

test("solution unlocks only after 3 hints and 3 failed tries", () => {
  assert.equal(L.canSeeSolution({ ...base, hintsUsed: 3, failedAttempts: 2 }), false);
  assert.equal(L.canSeeSolution({ ...base, hintsUsed: 2, failedAttempts: 9 }), false);
  assert.equal(L.canSeeSolution({ ...base, hintsUsed: 3, failedAttempts: 3 }), true);
});

test("after seeing the solution, done needs retype + explanation", () => {
  assert.equal(L.exerciseDone({ ...base, passed: true }), true);
  const seen = { ...base, passed: true, solutionShown: true };
  assert.equal(L.exerciseDone(seen), false);
  assert.equal(L.exerciseDone({ ...seen, retypePassed: true }), false);
  assert.equal(L.exerciseDone({ ...seen, retypePassed: true, explainPassed: true }), true);
});

test("streak counts consecutive days", () => {
  assert.equal(L.streak(["2026-10-12", "2026-10-13", "2026-10-14"], "2026-10-14"), 3);
  assert.equal(L.streak(["2026-10-12", "2026-10-13"], "2026-10-14"), 2); // not yet active today
  assert.equal(L.streak(["2026-10-10", "2026-10-14"], "2026-10-14"), 1);
  assert.equal(L.streak([], "2026-10-14"), 0);
});

test("lessons unlock in order and completion needs every gate", async () => {
  const d = db();
  d.insert(schema.lessons)
    .values([
      { id: "a", source: "s", sourceUrl: "u", path: "p", title: "A", chapter: "C", semester: 1, ord: 1 },
      { id: "b", source: "s", sourceUrl: "u", path: "p", title: "B", chapter: "C", semester: 1, ord: 2 },
    ])
    .run();
  const chunk = d.insert(schema.chunks).values({ lessonId: "a", ord: 0, heading: "h", bodyMd: "body" }).returning().get();
  d.insert(schema.exercises)
    .values({ id: "ex1", lessonId: "a", ord: 0, title: "t", sourceUrl: "u", importance: 3, promptMd: "p", starterCode: "", tests: "it('x', () => {})", solutionHidden: "secret" })
    .run();

  assert.deepEqual(L.lessonList().map((l) => l.status), ["available", "locked"]);
  assert.deepEqual(L.tryComplete("a").missing, ["1 check question", "the teach-back", "1 exercise"]);

  // The browser never receives the hidden solution.
  assert.equal(JSON.stringify(L.lessonDetail("a")).includes("secret"), false);
  // Solution stays locked at the start.
  assert.equal(L.revealSolution("ex1").solution, null);

  d.insert(schema.checks).values({ chunkId: chunk.id, question: "q", answer: "a", verdict: "correct", feedback: "", createdAt: 1 }).run();
  d.insert(schema.teachbacks).values({ lessonId: "a", text: "t", verdict: "understood", feedback: "", createdAt: 1 }).run();
  const r = await L.submitAttempt("ex1", "code", { testsPassed: true });
  assert.equal(r.passed, true);

  assert.deepEqual(L.tryComplete("a"), { completed: true, missing: [] });
  assert.deepEqual(L.lessonList().map((l) => l.status), ["completed", "available"]);
});
