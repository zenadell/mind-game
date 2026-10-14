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
`;

export function openDb(file = process.env.CODETUTOR_DB ?? path.join(process.cwd(), "data", "codetutor.db")) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(DDL);
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
