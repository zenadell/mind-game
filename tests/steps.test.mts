import { test } from "node:test";
import assert from "node:assert/strict";

process.env.CODETUTOR_DB = ":memory:";
process.env.CODETUTOR_FAKE_AI = "1";
const S = await import("../src/lib/steps");
const L = await import("../src/lib/learning");
const { cleanOdin, odinTitle } = await import("../src/lib/odin");
const { db, schema } = await import("../src/db");

test("examples are run to check them", () => {
  assert.deepEqual(S.runExample('let a = "Hi";\nconsole.log(a, 2);'), { ok: true, output: "Hi 2" });
  assert.equal(S.runExample("<p>Hello</p>").ok, false); // HTML is not JavaScript
  assert.equal(S.runExample("while (true) {}").ok, false); // never ends: stopped
});

test("Odin markdown loses its HTML wrappers but keeps code", () => {
  const md = '<div class="lesson-note" markdown="1">\n\nTip `<kbd>!</kbd>`\n\n</div>\n```html\n<div>keep</div>\n```';
  const out = cleanOdin(md);
  assert.doesNotMatch(out, /lesson-note/);
  assert.match(out, /<div>keep<\/div>/);
  assert.equal(odinTitle("foundations/javascript_basics/variables_and_operators.md"), "Variables and operators");
});

test("a lesson is planned once into steps, each written once and saved", async () => {
  const d = db();
  d.insert(schema.lessons).values({ id: "intro", source: "s", sourceUrl: "u", path: "p", title: "Intro", chapter: "C", semester: 1, ord: 1 }).run();
  d.insert(schema.chunks).values({ lessonId: "intro", ord: 0, heading: "JS", bodyMd: "JavaScript makes pages alive." }).run();
  d.insert(schema.odinLessons).values({ path: "f/x.md", title: "X", url: "https://odin/x", bodyMd: "- Describe the web" }).run();
  d.insert(schema.lessonOdin).values({ lessonId: "intro", odinPath: "f/x.md" }).run();

  const src = S.lessonSources("intro");
  assert.equal(src.odin[0].title, "X");
  const [a, b] = await Promise.all([S.planLesson("intro"), S.planLesson("intro")]);
  assert.equal(a.length, 2);
  assert.equal(b.length, 2);
  assert.equal(S.lessonSteps("intro").length, 2); // not planned twice

  const c = await S.stepContent(a[0].id);
  assert.equal(c.output, "Hello"); // the real output of running the example
  assert.ok(d.select().from(schema.steps).all()[0].contentJson);

  const g = await S.gradeStepCheck(a[0].id, c.question, c.answer_key, "because it helps");
  assert.equal(g.verdict, "correct");
  assert.deepEqual([...S.passedSteps("intro")], [a[0].id]);
  assert.deepEqual(L.tryComplete("intro").missing, ["1 check question", "the teach-back"]);
});
