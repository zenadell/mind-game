import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

// One SQLite file in ./data (git-ignored). Tables are created on first use,
// so there is no separate migration step for v1.
const DDL = `
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY, source TEXT NOT NULL, source_url TEXT NOT NULL, path TEXT NOT NULL,
  title TEXT NOT NULL, chapter TEXT NOT NULL, semester INTEGER NOT NULL, ord INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id TEXT NOT NULL, ord INTEGER NOT NULL,
  heading TEXT NOT NULL, body_md TEXT NOT NULL, explain_json TEXT);
CREATE INDEX IF NOT EXISTS chunks_lesson ON chunks(lesson_id, ord);
CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL, ord INTEGER NOT NULL, title TEXT NOT NULL,
  source_url TEXT NOT NULL, importance INTEGER NOT NULL, prompt_md TEXT NOT NULL,
  starter_code TEXT NOT NULL, tests TEXT, solution_hidden TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, exercise_id TEXT NOT NULL, code TEXT NOT NULL,
  passed INTEGER NOT NULL, feedback TEXT, hints_used INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS exercise_state (
  exercise_id TEXT PRIMARY KEY, hints_used INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0, solution_shown INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0, retype_passed INTEGER NOT NULL DEFAULT 0,
  explain_passed INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT, chunk_id INTEGER NOT NULL, question TEXT NOT NULL,
  answer TEXT NOT NULL, verdict TEXT NOT NULL, feedback TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS teachbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id TEXT NOT NULL, text TEXT NOT NULL,
  verdict TEXT NOT NULL, feedback TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS progress (
  lesson_id TEXT PRIMARY KEY, status TEXT NOT NULL, chunk_index INTEGER NOT NULL DEFAULT 0,
  mastery REAL NOT NULL DEFAULT 0, completed_at INTEGER);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id TEXT NOT NULL, role TEXT NOT NULL,
  content TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS messages_lesson ON messages(lesson_id, id);
CREATE TABLE IF NOT EXISTS api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT, purpose TEXT NOT NULL, model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL, output_tokens INTEGER NOT NULL, cache_read_tokens INTEGER NOT NULL,
  cache_write_tokens INTEGER NOT NULL, cost_usd REAL NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS activity (day TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id TEXT NOT NULL, source TEXT NOT NULL,
  source_key TEXT NOT NULL, kind TEXT NOT NULL, question TEXT NOT NULL, code TEXT, options_json TEXT,
  answer_key TEXT NOT NULL, context TEXT NOT NULL, stage INTEGER NOT NULL DEFAULT 0,
  due_day TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS reviews_due ON reviews(done, due_day);
CREATE TABLE IF NOT EXISTS review_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, review_id INTEGER NOT NULL, answer TEXT NOT NULL,
  correct INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS quizzes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, block_id TEXT NOT NULL, questions_json TEXT NOT NULL,
  results_json TEXT, score REAL, passed INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
  finished_at INTEGER);
CREATE TABLE IF NOT EXISTS odin_lessons (path TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL, body_md TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS lesson_odin (lesson_id TEXT NOT NULL, odin_path TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id TEXT NOT NULL, ord INTEGER NOT NULL, title TEXT NOT NULL,
  goal TEXT NOT NULL, content_json TEXT, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS steps_lesson ON steps(lesson_id, ord);
CREATE TABLE IF NOT EXISTS step_cache (step_id INTEGER NOT NULL, key TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY (step_id, key));
`;

// Columns added after the first release. Adding one that already exists throws, which is fine.
const MIGRATIONS = [
  "ALTER TABLE checks ADD COLUMN step_id INTEGER",
  "ALTER TABLE steps ADD COLUMN kind TEXT NOT NULL DEFAULT 'tutor'",
  "ALTER TABLE steps ADD COLUMN source_name TEXT",
  "ALTER TABLE steps ADD COLUMN source_url TEXT",
  "ALTER TABLE steps ADD COLUMN body_md TEXT",
];

export function openDb(file = process.env.CODETUTOR_DB ?? path.join(process.cwd(), "data", "codetutor.db")) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(DDL);
  for (const m of MIGRATIONS) {
    try {
      sqlite.exec(m);
    } catch {}
  }
  return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof openDb>;

// Reuse one connection across Next.js hot reloads.
const g = globalThis as unknown as { __codetutorDb?: Db };
export function db(): Db {
  if (!g.__codetutorDb) g.__codetutorDb = openDb();
  return g.__codetutorDb;
}

export { schema };
