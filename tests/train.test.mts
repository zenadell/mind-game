import { test } from "node:test";
import assert from "node:assert/strict";

process.env.CODETUTOR_DB = ":memory:";
process.env.CODETUTOR_FAKE_AI = "1";
const T = await import("../src/lib/train");
const { db, schema } = await import("../src/db");

function complete(...ids: string[]) {
  for (const id of ids)
    db().insert(schema.progress).values({ lessonId: id, status: "completed", chunkIndex: 0, completedAt: 1 }).onConflictDoNothing().run();
}

test("problems stay locked until their lessons are done", () => {
  const before = T.trainOverview();
  assert.equal(before.totals.unlocked, 0);
  assert.equal(before.next, null);
  assert.equal(before.reading.unlocked, false);
  assert.throws(() => T.submit("fizzbuzz", "", true), /locked/);
  complete("function-basics", "while-for", "ifelse");
  const after = T.trainOverview();
  assert.ok(after.totals.unlocked > 0);
  assert.equal(after.next?.id, "fizzbuzz"); // easiest unlocked problem first
  assert.equal(after.reading.unlocked, true);
  assert.equal(T.problemView("two-sum").locked, true);
});

test("hints need real tries; the solution needs all hints and 3 failed submits", async () => {
  const id = "sum-to";
  let v = T.problemView(id).state;
  assert.equal(v.canHint.ok, false); // try first
  assert.equal((await T.hint(id, "", "")).hint, null);
  for (let i = 1; i <= 3; i++) {
    T.submit(id, "function sumTo(n) {}", false);
    const h = await T.hint(id, "function sumTo(n) {}", "Example 1");
    assert.ok(h.hint, `hint ${i}`);
    v = h.state;
    assert.equal(v.hints.length, i);
  }
  assert.equal(v.canSeeSolution, true); // 3 hints, 3 failures
  await T.solution(id);
  // Solving after studying the solution is "studied", with small XP and no clean bonus.
  const r = T.submit(id, "function sumTo(n) { return n * (n + 1) / 2; }", true);
  assert.equal(r.firstSolve, true);
  assert.equal(r.game?.gained, 20);
  assert.equal(r.state.studied, true);
  assert.ok(r.game?.badges.some((b) => b.id === "solve-1"));
});

test("a clean solve pays by difficulty plus a no-hint bonus, once", () => {
  const r = T.submit("fizzbuzz", "...", true);
  assert.equal(r.game?.gained, 60 + 40);
  assert.equal(T.submit("fizzbuzz", "...", true).game, null);
  assert.equal(T.trainOverview().patterns.find((p) => p.id === "warmup")!.problems.find((p) => p.id === "fizzbuzz")!.status, "solved");
});

test("interview mode blocks hints and pays for beating the clock", async () => {
  const id = "power-of-two";
  T.interview(id, "start");
  T.submit(id, "x", false);
  const h = await T.hint(id, "x", "");
  assert.equal(h.hint, null);
  assert.match(h.reason!, /Interview mode/);
  const r = T.submit(id, "y", true);
  assert.equal(r.game?.gained, 60 + 40 + 60); // solve + no hints + beat the clock
  assert.ok(r.state.interviewMs !== null && r.state.interview === null);
});

test("complexity question only after solving, pays once when right", async () => {
  await assert.rejects(() => T.complexity("palindrome-number", "O(n)"), /Solve the problem first/);
  const r = await T.complexity("fizzbuzz", "O(1) because n is checked a fixed number of times");
  assert.equal(r.verdict, "correct");
  assert.equal(r.game?.gained, 30);
});

test("code reading: output answers come from running the code", async () => {
  const first = await T.nextReading();
  assert.equal(first.reading.kind, "output");
  assert.equal(first.reading.correctIndex, null); // hidden until answered
  const again = await T.nextReading();
  assert.equal(again.reading.id, first.reading.id); // the open one comes back
  const res = await T.answerReading(first.reading.id, { choice: 1 });
  assert.equal(res.reading.verdict, "correct"); // the fake code prints 6, option 1
  assert.equal(res.reading.correctIndex, 1);
  const second = await T.nextReading();
  assert.equal(second.reading.kind, "bug");
  assert.notEqual(second.reading.id, first.reading.id);
});
