import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkLesson, cleanMarkdown, parseTaskFile, slugOf } from "../src/lib/jsinfo-parse";

test("slugOf drops the number prefix", () => {
  assert.equal(slugOf("04-variables"), "variables");
});

test("parseTaskFile reads importance and title", () => {
  const t = parseTaskFile("importance: 4\n\n---\n\n# Function pow(x,n)\n\nWrite a function.");
  assert.deepEqual(t, { importance: 4, title: "Function pow(x,n)", body: "Write a function." });
});

test("cleanMarkdown converts javascript.info markup", () => {
  const md = [
    "See <info:var> and [closures](info:closure).",
    "```js run no-beautify",
    "*!*",
    "let a = 1;",
    "*/!*",
    "alert(*!*a*/!*);",
    "```",
    "````smart header=\"Case matters\"",
    "Inside the box.",
    "```js",
    "let x;",
    "```",
    "````",
    "![diagram](variable.svg)",
    "[cut]",
  ].join("\n");
  const out = cleanMarkdown(md, "/jsinfo/variables");
  assert.match(out, /\[var\]\(https:\/\/javascript\.info\/var\)/);
  assert.match(out, /\(https:\/\/javascript\.info\/closure\)/);
  assert.match(out, /```js\nlet a = 1;\nalert\(a\);\n```/);
  assert.match(out, /> \*\*💡 Case matters\*\*\n>\n> Inside the box\.\n> ```js\n> let x;\n> ```/);
  assert.match(out, /!\[diagram\]\(\/jsinfo\/variables\/variable\.svg\)/);
  assert.doesNotMatch(out, /\[cut\]|\*!\*/);
});

test("chunkLesson splits at ## headings and ignores headings in code", () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
  const md = `${words(50)}\n\n## A variable [#a-var]\n\n${words(60)}\n\n\`\`\`js\n## not a heading\n\`\`\`\n\n## Constants\n\n${words(60)}`;
  const chunks = chunkLesson("Variables", md);
  assert.deepEqual(chunks.map((c) => c.heading), ["Variables", "A variable", "Constants"]);
  assert.match(chunks[1].body, /## not a heading/);
});

test("chunkLesson merges tiny chunks into the next one", () => {
  const chunks = chunkLesson("T", `Short intro.\n\n## Big\n\n${"word ".repeat(80)}`);
  assert.equal(chunks.length, 1);
  assert.match(chunks[0].body, /Short intro/);
});
