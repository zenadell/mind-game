// Imports javascript.info Part 1 ("The JavaScript language") into SQLite.
//
//   npm run import
//
// It clones the tutorial repo into ./content (git-ignored), turns each lesson
// into chunks and each task into an exercise. Content stays on this machine:
// javascript.info is licensed CC BY-NC (personal, non-commercial use with
// attribution). See https://github.com/javascript-tutorial/en.javascript.info

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { openDb, schema } from "../src/db";
import {
  chunkLesson,
  cleanMarkdown,
  parseTaskFile,
  semesterForChapter,
  slugOf,
  splitTitle,
} from "../src/lib/jsinfo-parse";

const REPO = "https://github.com/javascript-tutorial/en.javascript.info.git";
const root = process.cwd();
const repoDir = path.join(root, "content", "en.javascript.info");
const imgDir = path.join(root, "public", "jsinfo");
const SITE = "https://javascript.info";

function read(p: string): string | null {
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

function numberedDirs(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d+-/.test(d.name))
    .map((d) => d.name)
    .sort((a, b) => parseInt(a) - parseInt(b));
}

if (!fs.existsSync(repoDir)) {
  console.log("Downloading javascript.info (one time)...");
  fs.mkdirSync(path.dirname(repoDir), { recursive: true });
  execFileSync("git", ["clone", "--depth", "1", REPO, repoDir], { stdio: "inherit" });
}

const db = openDb();
const partDir = path.join(repoDir, "1-js");
let lessonCount = 0;
let chunkCount = 0;
let exerciseCount = 0;

// Keep the learner's progress; only refresh content. Cached explanations are
// kept when a chunk's text did not change.
const oldExplain = new Map<string, string>();
for (const c of db.select().from(schema.chunks).all()) {
  if (c.explainJson) oldExplain.set(`${c.lessonId}|${c.bodyMd}`, c.explainJson);
}

db.transaction((tx) => {
  tx.delete(schema.chunks).run();
  tx.delete(schema.exercises).run();
  tx.delete(schema.lessons).run();

  numberedDirs(partDir).forEach((chapterDir, ci) => {
    const chapterIndex = ci + 1;
    const chapterTitle = splitTitle(read(path.join(partDir, chapterDir, "index.md")) ?? "").title || slugOf(chapterDir);

    numberedDirs(path.join(partDir, chapterDir)).forEach((lessonDir, li) => {
      const dir = path.join(partDir, chapterDir, lessonDir);
      const article = read(path.join(dir, "article.md"));
      if (!article) return;
      const id = slugOf(lessonDir);
      const { title, body } = splitTitle(article);
      const imageBase = `/jsinfo/${id}`;

      // Copy this lesson's images so they work offline.
      for (const f of fs.readdirSync(dir)) {
        if (/\.(svg|png|jpe?g|gif)$/i.test(f)) {
          fs.mkdirSync(path.join(imgDir, id), { recursive: true });
          fs.copyFileSync(path.join(dir, f), path.join(imgDir, id, f));
        }
      }

      tx.insert(schema.lessons)
        .values({
          id,
          source: "javascript.info",
          sourceUrl: `${SITE}/${id}`,
          path: `1-js/${chapterDir}/${lessonDir}`,
          title,
          chapter: chapterTitle,
          semester: semesterForChapter(chapterIndex),
          ord: chapterIndex * 100 + li + 1,
        })
        .run();
      lessonCount++;

      chunkLesson(title, cleanMarkdown(body, imageBase)).forEach((c, i) => {
        tx.insert(schema.chunks)
          .values({
            lessonId: id,
            ord: i,
            heading: c.heading,
            bodyMd: c.body,
            explainJson: oldExplain.get(`${id}|${c.body}`) ?? null,
          })
          .run();
        chunkCount++;
      });

      numberedDirs(dir).forEach((taskDir, ti) => {
        const tdir = path.join(dir, taskDir);
        const taskMd = read(path.join(tdir, "task.md"));
        if (!taskMd) return;
        const task = parseTaskFile(taskMd);
        const view = path.join(tdir, "_js.view");
        const solutionMd = read(path.join(tdir, "solution.md")) ?? "";
        const solutionJs = read(path.join(view, "solution.js"));
        const taskId = slugOf(taskDir);
        // Our in-browser test runner has no sinon; the grader model checks those instead.
        const tests = read(path.join(view, "test.js"));
        const runnableTests = tests && !/\bsinon\./.test(tests) ? tests : null;
        tx.insert(schema.exercises)
          .values({
            id: taskId,
            lessonId: id,
            ord: ti,
            title: task.title,
            sourceUrl: `${SITE}/task/${taskId}`,
            importance: task.importance,
            promptMd: cleanMarkdown(task.body, imageBase),
            starterCode: read(path.join(view, "source.js")) ?? "// Write your code here\n",
            tests: runnableTests,
            solutionHidden: [cleanMarkdown(solutionMd, imageBase), solutionJs ? "```js\n" + solutionJs + "\n```" : ""]
              .filter(Boolean)
              .join("\n\n"),
          })
          .onConflictDoNothing()
          .run();
        exerciseCount++;
      });
    });
  });
});

// Remove progress rows for lessons that no longer exist.
for (const p of db.select().from(schema.progress).all()) {
  const exists = db.select().from(schema.lessons).where(eq(schema.lessons.id, p.lessonId)).get();
  if (!exists) db.delete(schema.progress).where(eq(schema.progress.lessonId, p.lessonId)).run();
}

console.log(`Imported ${lessonCount} lessons, ${chunkCount} chunks, ${exerciseCount} exercises.`);
