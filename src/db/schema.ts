import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// Course content (filled by `npm run import`).

export const lessons = sqliteTable("lessons", {
  id: text("id").primaryKey(), // e.g. "variables"
  source: text("source").notNull(), // "javascript.info"
  sourceUrl: text("source_url").notNull(),
  path: text("path").notNull(),
  title: text("title").notNull(),
  chapter: text("chapter").notNull(),
  semester: integer("semester").notNull(),
  ord: integer("ord").notNull(),
});

export const chunks = sqliteTable("chunks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lessonId: text("lesson_id").notNull(),
  ord: integer("ord").notNull(),
  heading: text("heading").notNull(),
  bodyMd: text("body_md").notNull(),
  // Tutor-made short explanation + check question, generated once and cached.
  explainJson: text("explain_json"),
});

export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(), // task slug
  lessonId: text("lesson_id").notNull(),
  ord: integer("ord").notNull(),
  title: text("title").notNull(),
  sourceUrl: text("source_url").notNull(),
  importance: integer("importance").notNull(),
  promptMd: text("prompt_md").notNull(),
  starterCode: text("starter_code").notNull(),
  tests: text("tests"), // mocha-style tests, when the source has them
  solutionHidden: text("solution_hidden").notNull(), // never sent to the browser unless unlocked
});

// The learner's work.

export const attempts = sqliteTable("attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  exerciseId: text("exercise_id").notNull(),
  code: text("code").notNull(),
  passed: integer("passed", { mode: "boolean" }).notNull(),
  feedback: text("feedback"),
  hintsUsed: integer("hints_used").notNull(),
  createdAt: integer("created_at").notNull(),
});

// Hint ladder state per exercise. The server decides what may be shown.
export const exerciseState = sqliteTable("exercise_state", {
  exerciseId: text("exercise_id").primaryKey(),
  hintsUsed: integer("hints_used").notNull().default(0),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  solutionShown: integer("solution_shown", { mode: "boolean" }).notNull().default(false),
  passed: integer("passed", { mode: "boolean" }).notNull().default(false),
  // After seeing the solution he must retype it from memory and explain it.
  retypePassed: integer("retype_passed", { mode: "boolean" }).notNull().default(false),
  explainPassed: integer("explain_passed", { mode: "boolean" }).notNull().default(false),
});

export const checks = sqliteTable("checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chunkId: integer("chunk_id").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  verdict: text("verdict").notNull(), // correct | partly | wrong
  feedback: text("feedback").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const teachbacks = sqliteTable("teachbacks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lessonId: text("lesson_id").notNull(),
  text: text("text").notNull(),
  verdict: text("verdict").notNull(), // understood | partly | not_yet
  feedback: text("feedback").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const progress = sqliteTable("progress", {
  lessonId: text("lesson_id").primaryKey(),
  status: text("status").notNull(), // started | completed
  chunkIndex: integer("chunk_index").notNull().default(0),
  mastery: real("mastery").notNull().default(0),
  completedAt: integer("completed_at"),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lessonId: text("lesson_id").notNull(),
  role: text("role").notNull(), // user | assistant
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
});

// Every paid API call, for the running cost counter.
export const apiUsage = sqliteTable("api_usage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  purpose: text("purpose").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  cacheReadTokens: integer("cache_read_tokens").notNull(),
  cacheWriteTokens: integer("cache_write_tokens").notNull(),
  costUsd: real("cost_usd").notNull(),
  createdAt: integer("created_at").notNull(),
});

// One row per day he did something, for the streak.
export const activity = sqliteTable("activity", {
  day: text("day").primaryKey(), // YYYY-MM-DD in his time zone
});
