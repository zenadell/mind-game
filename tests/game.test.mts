import { test } from "node:test";
import assert from "node:assert/strict";

process.env.CODETUTOR_DB = ":memory:";
const G = await import("../src/lib/game");
const C = await import("../src/lib/core");
const { checkHook } = await import("../src/lib/steps");
const { db, schema } = await import("../src/db");

test("levels: 0, 100, 300, 600, 1000 XP", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(G.xpForLevel), [0, 100, 300, 600, 1000]);
  assert.deepEqual(G.levelOf(0), { n: 1, name: "Rookie", into: 0, need: 100 });
  assert.deepEqual(G.levelOf(350), { n: 3, name: "Script Kid", into: 50, need: 300 });
});

test("combo multiplier: x2 from 3 in a row, x3 from 6", () => {
  assert.deepEqual([0, 2, 3, 5, 6, 20].map(G.comboMultiplier), [1, 1, 2, 2, 3, 3]);
});

test("XP pays once per key, levels up, reaches the goal, earns badges", () => {
  G.setDailyGoal(50);
  const first = G.award("read", "Part read", { key: "read:1" })!;
  assert.equal(first.gained, 5);
  assert.deepEqual(first.badges.map((b) => b.id).includes("first-step"), true);
  assert.equal(G.award("read", "Part read", { key: "read:1" }), null); // no double pay

  // A run of first-try answers: the multiplier grows.
  const gains = [1, 2, 3, 4, 5].map((i) => {
    G.comboHit();
    return G.award("checkFirstTry", "Right", { key: `check:${i}`, combo: true })!;
  });
  assert.deepEqual(gains.map((g) => g.gained), [20, 20, 40, 40, 40]);
  assert.equal(gains.some((g) => g.goalReached), true); // passed 50 XP today
  assert.equal(gains.at(-1)!.badges.some((b) => b.id === "on-fire"), true);
  assert.equal(gains.some((g) => g.leveledUp?.n === 2), true);
  G.comboBreak();
  assert.equal(G.comboNow(), 0);
  const state = G.gameState();
  assert.equal(state.total, 165);
  assert.equal(state.comboBest, 5);
});

test("a streak freeze covers one missed day", () => {
  const d = db();
  d.delete(schema.activity).run();
  d.insert(schema.settings).values({ key: "game.freezes", value: "1" }).onConflictDoUpdate({ target: schema.settings.key, set: { value: "1" } }).run();
  C.markActive("2026-10-10");
  C.markActive("2026-10-11");
  // missed 2026-10-12
  C.markActive("2026-10-13");
  assert.equal(C.currentStreak("2026-10-13"), 4);
  assert.equal(C.freezes(), 0);
});

test("7 days in a row earns a freeze", () => {
  const d = db();
  d.delete(schema.activity).run();
  d.delete(schema.freezeDays).run();
  for (let day = 1; day <= 7; day++) C.markActive(`2026-11-0${day}`);
  assert.equal(C.currentStreak("2026-11-07"), 7);
  assert.equal(C.freezes(), 1);
});

test("guess-first puzzles with code are checked by running the code", () => {
  const h = { question: "What prints?", code: 'console.log("2" + 2)', options: ["4", "22", "error"], correct_index: 0, reveal: "" };
  assert.equal(checkHook(h)!.correct_index, 1);
  assert.equal(checkHook({ ...h, options: ["4", "5"] }), null); // no option matches: dropped
  assert.equal(checkHook({ ...h, code: "", correct_index: 2 })!.correct_index, 2);
});
