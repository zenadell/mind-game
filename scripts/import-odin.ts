// Imports the matching The Odin Project lessons (run after import-jsinfo).
//
//   npm run import
//
// Clones TheOdinProject/curriculum into ./content (git-ignored). The curriculum is
// CC BY-NC-SA 4.0: personal, non-commercial use with attribution; it stays on this machine.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { openDb, schema } from "../src/db";
import { ODIN_FOR, cleanOdin, odinTitle, odinUrl } from "../src/lib/odin";

const REPO = "https://github.com/TheOdinProject/curriculum.git";
const repoDir = path.join(process.cwd(), "content", "curriculum");

if (!fs.existsSync(repoDir)) {
  console.log("Downloading The Odin Project curriculum (one time)...");
  execFileSync("git", ["clone", "--depth", "1", REPO, repoDir], { stdio: "inherit" });
}

const db = openDb();
const known = new Set(db.select({ id: schema.lessons.id }).from(schema.lessons).all().map((l) => l.id));
let files = 0;
let links = 0;

db.transaction((tx) => {
  tx.delete(schema.lessonOdin).run();
  tx.delete(schema.odinLessons).run();
  const saved = new Set<string>();
  for (const [lessonId, paths] of Object.entries(ODIN_FOR)) {
    if (!known.has(lessonId)) {
      console.warn(`  (skipping ${lessonId}: no such javascript.info lesson)`);
      continue;
    }
    for (const p of paths) {
      const file = path.join(repoDir, p);
      if (!fs.existsSync(file)) {
        console.warn(`  (missing Odin file ${p})`);
        continue;
      }
      if (!saved.has(p)) {
        tx.insert(schema.odinLessons)
          .values({ path: p, title: odinTitle(p), url: odinUrl(p), bodyMd: cleanOdin(fs.readFileSync(file, "utf8")) })
          .run();
        saved.add(p);
        files++;
      }
      tx.insert(schema.lessonOdin).values({ lessonId, odinPath: p }).run();
      links++;
    }
  }
});

console.log(`Imported ${files} Odin lessons, linked ${links} times.`);
