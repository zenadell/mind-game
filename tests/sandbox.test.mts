import { test } from "node:test";
import assert from "node:assert/strict";

// In a worker `self` is the global object; mimic that, then call onmessage directly.
type Msg = { logs: { type: string; text: string }[]; error: string | null; results: { name: string; passed: boolean; error?: string }[] | null };
const self = globalThis as unknown as { onmessage?: (e: { data: unknown }) => Promise<void>; postMessage: (m: Msg) => void; last?: Msg; self: unknown };
self.self = self;
self.postMessage = (m) => {
  self.last = m;
};
await import("../src/lib/sandbox-worker.js");

async function run(code: string, tests: string | null = null, inputs: string[] = []): Promise<Msg> {
  await self.onmessage!({ data: { code, tests, inputs } });
  return self.last!;
}

test("captures console.log and alert", async () => {
  const r = await run("console.log('hi', 1 + 1, [1, 'a'], {x: 1}); alert('boo')");
  assert.deepEqual(r.logs, [
    { type: "log", text: 'hi 2 [1, "a"] { x: 1 }' },
    { type: "alert", text: "boo" },
  ]);
});

test("prompt reads from inputs", async () => {
  const r = await run("let n = prompt('Age?'); console.log(n * 2)", null, ["21"]);
  assert.equal(r.logs.at(-1)!.text, "42");
});

test("reports errors with the learner's line number", async () => {
  const r = await run("let a = 1;\nundefinedThing();");
  assert.match(r.error!, /ReferenceError: undefinedThing is not defined \(line 2\)/);
});

test("runs mocha-style tests against the code", async () => {
  const tests = `describe("pow", function() {
    it("2^3 = 8", function() { assert.equal(pow(2, 3), 8); });
    it("deep", function() { assert.deepEqual([pow(1, 5)], [1]); });
  });`;
  const good = await run("function pow(x, n) { return x ** n; }", tests);
  assert.deepEqual(good.results!.map((t) => t.passed), [true, true]);
  const bad = await run("function pow(x, n) { return x * n; }", tests);
  assert.equal(bad.results![0].passed, false);
  assert.match(bad.results![0].error!, /expected 6 to equal 8/);
});
