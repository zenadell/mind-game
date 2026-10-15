import { test } from "node:test";
import assert from "node:assert/strict";

process.env.CODETUTOR_DB = ":memory:";
process.env.CODETUTOR_FAKE_AI = "1";
const S = await import("../src/lib/steps");
const L = await import("../src/lib/learning");
const { cleanOdin, odinTitle, splitOdin, parseSpec } = await import("../src/lib/odin");
const { db, schema } = await import("../src/db");

test("examples are run to check them", () => {
  assert.deepEqual(S.runExample('let a = "Hi";\nconsole.log(a, 2);'), { ok: true, output: "Hi 2" });
  assert.equal(S.runExample("<p>Hello</p>").ok, false); // HTML is not JavaScript
  assert.equal(S.runExample("while (true) {}").ok, false); // never ends: stopped
});

test("Odin lessons split into goals, teaching sections and reading links", () => {
  const md = cleanOdin(
    [
      "### Introduction",
      "Hello.",
      "### Lesson overview",
      "- Explain the web.",
      "- Name a browser.",
      "### How it works",
      '<div class="lesson-note" markdown="1">',
      "Text `<kbd>!</kbd>`",
      "</div>",
      "```html",
      "### not a heading",
      "<div>keep</div>",
      "```",
      "### Assignment",
      "1. Read [MDN on the web](https://developer.mozilla.org/x).",
      "### Knowledge check",
      "- Why?",
    ].join("\n"),
  );
  const parts = splitOdin(md);
  assert.deepEqual(parts.goals, ["Explain the web.", "Name a browser."]);
  assert.deepEqual(parts.sections.map((x) => x.heading), ["Introduction", "How it works"]);
  assert.match(parts.sections[1].body, /<div>keep<\/div>/);
  assert.match(parts.sections[1].body, /### not a heading/);
  assert.doesNotMatch(parts.sections[1].body, /lesson-note/);
  assert.deepEqual(parts.reading, [{ text: "MDN on the web", url: "https://developer.mozilla.org/x" }]);
  assert.deepEqual(parseSpec("a/b.md#How it works"), { path: "a/b.md", heading: "How it works" });
  assert.equal(odinTitle("foundations/javascript_basics/variables_and_operators.md"), "Variables and operators");
});

test("code blocks are found in order, also inside quotes", () => {
  const md = "Text\n```js\nlet a;\n```\n> **Tip**\n>\n> ```js\n> var b;\n> ```";
  assert.deepEqual(S.codeBlocks(md), [
    { lang: "js", code: "let a;" },
    { lang: "js", code: "var b;" },
  ]);
});

test("a lesson is the original text: Odin sections first, then javascript.info, instantly", async () => {
  const d = db();
  d.insert(schema.lessons).values({ id: "intro", source: "s", sourceUrl: "https://javascript.info/intro", path: "p", title: "Intro", chapter: "C", semester: 1, ord: 1 }).run();
  d.insert(schema.chunks).values({ lessonId: "intro", ord: 0, heading: "What is JS", bodyMd: "JavaScript makes pages alive.\n```js\nconsole.log(1)\n```" }).run();
  d.insert(schema.odinLessons).values({ path: "f/x.md", title: "X", url: "https://odin/x", bodyMd: "### Lesson overview\n- Describe the web\n### The web\nComputers talk.\n### Assignment\n[Read](https://mdn/x)" }).run();
  d.insert(schema.lessonOdin).values({ lessonId: "intro", odinPath: "f/x.md" }).run();
  // An old AI-planned step is replaced by the original sections.
  d.insert(schema.steps).values({ lessonId: "intro", ord: 0, title: "old", goal: "g", createdAt: 1 }).run();

  const detail = L.lessonDetail("intro")!;
  assert.deepEqual(detail.steps.map((x) => [x.sourceName, x.title]), [
    ["The Odin Project", "The web"],
    ["javascript.info", "What is JS"],
  ]);
  assert.equal(detail.steps[1].bodyMd.includes("makes pages alive"), true);
  assert.deepEqual(detail.goals, ["Describe the web"]);
  assert.deepEqual(detail.reading, [{ text: "Read", url: "https://mdn/x" }]);

  const [a, b] = await Promise.all([S.sectionHelp(detail.steps[1].id), S.sectionHelp(detail.steps[1].id)]);
  assert.equal(a.question, b.question);
  assert.equal(d.select().from(schema.stepCache).all().length, 1); // made once, saved

  const code = await S.explainCode(detail.steps[1].id, 0);
  assert.equal(code.lines.length, 1);

  const g = await S.gradeStepCheck(detail.steps[1].id, a.question, a.answer_key, "because it helps");
  assert.equal(g.verdict, "correct");
  assert.deepEqual(L.tryComplete("intro").missing, ["1 check question", "the teach-back"]);
});
