import { test } from "node:test";
import assert from "node:assert/strict";

// Run every reference solution through the same test harness the browser uses.
type Msg = { logs: unknown[]; error: string | null; results: { name: string; passed: boolean; error?: string }[] | null };
const self = globalThis as unknown as { onmessage?: (e: { data: unknown }) => Promise<void>; postMessage: (m: Msg) => void; last?: Msg; self: unknown };
self.self = self;
self.postMessage = (m) => {
  self.last = m;
};
await import("../src/lib/sandbox-worker.js");
const { PROBLEMS, PATTERNS, buildTests, starterCode } = await import("../src/lib/problems");

async function run(code: string, tests: string): Promise<Msg> {
  await self.onmessage!({ data: { code, tests, inputs: [] } });
  return self.last!;
}

test("every problem is well formed", () => {
  const ids = new Set<string>();
  for (const p of PROBLEMS) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    assert.ok(PATTERNS.some((x) => x.id === p.pattern), `${p.id}: unknown pattern`);
    assert.ok(p.examples >= 1 && p.examples < p.cases.length, `${p.id}: needs examples and hidden tests`);
    assert.ok(p.ref.includes(p.methods ? `class ${p.fn} ` : `function ${p.fn}(`), `${p.id}: reference must define ${p.fn}`);
  }
});

for (const p of PROBLEMS) {
  test(`reference solution passes every test: ${p.id}`, async () => {
    const r = await run(p.ref, buildTests(p, "all"));
    assert.equal(r.error, null, `${p.id}: ${r.error}`);
    const failed = r.results!.filter((x) => !x.passed);
    assert.deepEqual(failed, [], `${p.id} failed: ${failed.map((f) => f.error).join(" | ")}`);
    assert.equal(r.results!.length, p.cases.length);
  });
}

test("the starter code fails with a helpful message", async () => {
  const p = PROBLEMS.find((x) => x.id === "two-sum")!;
  const r = await run(starterCode(p), buildTests(p, "examples"));
  assert.equal(r.results!.length, p.examples);
  assert.match(r.results![0].error!, /Input: \[2,7,11,15\], 9\nExpected: \[0,1\]\nYour output: undefined/);
  const wrongName = await run("function twosum(){}", buildTests(p, "examples"));
  assert.match(wrongName.results![0].error!, /can't find a function named twoSum/);
});

test("design problems: starter code is a class and failures list the calls", async () => {
  const p = PROBLEMS.find((x) => x.id === "min-stack")!;
  const start = starterCode(p);
  assert.match(start, /class MinStack \{\n  constructor\(\) \{/);
  assert.match(start, /getMin\(\) \{/);
  const r = await run(start, buildTests(p, "examples"));
  assert.match(r.results![0].error!, /^Calls: new MinStack\(\), push\(-2\), push\(0\)/);
});
