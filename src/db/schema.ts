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
  chunkId: integer("chunk_id").notNull(), // older lessons; 0 for step checks
  stepId: integer("step_id"),
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

// App settings, e.g. which AI model to use. Stays on this machine.
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Spaced repetition: questions to ask again after 1, 3 and 7 days.
export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lessonId: text("lesson_id").notNull(),
  source: text("source").notNull(), // "check" | "quiz"
  sourceKey: text("source_key").notNull(), // e.g. chunk id; one active review per key
  kind: text("kind").notNull(), // "short" | "choice"
  question: text("question").notNull(),
  code: text("code"),
  optionsJson: text("options_json"), // for "choice"
  answerKey: text("answer_key").notNull(), // for "choice": the correct option index
  context: text("context").notNull(), // lesson text the grader may use
  stage: integer("stage").notNull().default(0),
  dueDay: text("due_day").notNull(), // YYYY-MM-DD in the learner's time zone
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

export const reviewLog = sqliteTable("review_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reviewId: integer("review_id").notNull(),
  answer: text("answer").notNull(),
  correct: integer("correct", { mode: "boolean" }).notNull(),
  createdAt: integer("created_at").notNull(),
});

// A quiz after every few lessons. The next lessons unlock when it is passed.
export const quizzes = sqliteTable("quizzes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  blockId: text("block_id").notNull(),
  questionsJson: text("questions_json").notNull(),
  resultsJson: text("results_json"),
  score: real("score"),
  passed: integer("passed", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
  finishedAt: integer("finished_at"),
});

// The Odin Project lessons (filled by `npm run import`), linked to javascript.info lessons.
export const odinLessons = sqliteTable("odin_lessons", {
  path: text("path").primaryKey(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  bodyMd: text("body_md").notNull(),
});

export const lessonOdin = sqliteTable("lesson_odin", {
  lessonId: text("lesson_id").notNull(),
  odinPath: text("odin_path").notNull(),
});

// A lesson's teaching steps, planned by the tutor from both sources.
// The deep content of each step is written the first time it is opened, then saved.
export const steps = sqliteTable("steps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lessonId: text("lesson_id").notNull(),
  ord: integer("ord").notNull(),
  title: text("title").notNull(),
  goal: text("goal").notNull(),
  contentJson: text("content_json"),
  createdAt: integer("created_at").notNull(),
  // "source": a section of the original text (javascript.info or Odin), shown as written.
  kind: text("kind").notNull().default("tutor"),
  sourceName: text("source_name"),
  sourceUrl: text("source_url"),
  bodyMd: text("body_md"),
});

// The tutor's help for a step, written once and saved: "help", "deep", "code:<n>".
export const stepCache = sqliteTable("step_cache", {
  stepId: integer("step_id").notNull(),
  key: text("key").notNull(),
  json: text("json").notNull(),
});
