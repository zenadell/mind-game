import vm from "node:vm";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ProviderError, askJson } from "./ai";
import { NotFound, allQuizBlocks, lessonList, markActive } from "./learning";
import { CHECK_SYSTEM, CheckShape, QUIZ_SYSTEM, QuizShape, type QuizQuestion } from "./prompts";
import { scheduleReview } from "./review";

export const PASS_MARK = 0.7;

/** Text the learner would see printed, so an option can be compared with it. */
export function normalize(s: string): string {
  return s
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Run a snippet the tutor wrote and return what it prints (null if it errors or prints nothing). */
export function printedBy(code: string): string | null {
  const lines: string[] = [];
  const fmt = (v: unknown) => (typeof v === "string" ? v : typeof v === "object" && v !== null ? JSON.stringify(v) : String(v));
  const out = (...a: unknown[]) => lines.push(a.map(fmt).join(" "));
  try {
    vm.runInNewContext(code, { console: { log: out }, alert: out }, { timeout: 300 });
  } catch {
    return null;
  }
  return lines.length ? lines.join(" ") : null;
}

/**
 * Check "what does this print?" questions by running the code: the correct option is
 * whatever the code really prints. Questions whose output matches no option are dropped.
 */
export function verifyQuestions(qs: QuizQuestion[]): QuizQuestion[] {
  const good: QuizQuestion[] = [];
  for (const q of qs) {
    if (q.type === "short") {
      if (q.answer_key.trim()) good.push({ ...q, options: [], correct_index: -1 });
      continue;
    }
    if (q.options.length < 2) continue;
    if (q.code.trim() && /console\.log|alert/.test(q.code)) {
      const printed = printedBy(q.code);
      if (printed === null) continue;
      const idx = q.options.findIndex((o) => normalize(o) === normalize(printed));
      if (idx === -1) continue;
      good.push({ ...q, correct_index: idx });
      continue;
    }
    if (q.correct_index >= 0 && q.correct_index < q.options.length) good.push(q);
  }
  return good;
}

function blockById(blockId: string) {
  const block = allQuizBlocks().find((b) => b.id === blockId);
  if (!block) throw new NotFound("quiz");
  return block;
}

function lessonText(lessonIds: string[]): string {
  const d = db();
  return lessonIds
    .map((id) => {
      const l = d.select().from(schema.lessons).where(eq(schema.lessons.id, id)).get();
      const chunks = d.select().from(schema.chunks).where(eq(schema.chunks.lessonId, id)).orderBy(asc(schema.chunks.ord)).all();
      return `<lesson id="${id}" title="${l?.title ?? id}">\n${chunks.map((c) => `## ${c.heading}\n${c.bodyMd}`).join("\n\n")}\n</lesson>`;
    })
    .join("\n\n");
}

export function quizStatus(blockId: string) {
  for (const l of lessonList()) if (l.quizAfter?.id === blockId) return l.quizAfter.status;
  return "locked" as const;
}

/** What the browser sees: no answers. */
function publicQuestions(qs: QuizQuestion[]) {
  return qs.map((q) => ({ type: q.type, question: q.question, code: q.code, options: q.options }));
}

/** The open quiz for a block, or a new one. Each new attempt gets fresh questions. */
export async function startQuiz(blockId: string) {
  const block = blockById(blockId);
  if (quizStatus(blockId) === "locked") return { locked: true as const };
  const d = db();
  const open = d.select().from(schema.quizzes).where(eq(schema.quizzes.blockId, blockId)).orderBy(desc(schema.quizzes.id)).get();
  if (open && !open.finishedAt) {
    return { locked: false as const, quizId: open.id, questions: publicQuestions(JSON.parse(open.questionsJson)) };
  }
  const text = lessonText(block.lessonIds);
  let questions: QuizQuestion[] = [];
  for (let attempt = 0; attempt < 2 && questions.length < 4; attempt++) {
    const res = await askJson({
      purpose: "quiz",
      role: "tutor",
      system: QUIZ_SYSTEM,
      prompt: `${text}\n\nWrite the quiz now.`,
      shape: QuizShape,
      maxTokens: 24000,
    });
    questions = verifyQuestions(res.questions).slice(0, 6);
  }
  if (questions.length < 3) throw new ProviderError("Couldn't make a good quiz this time. Please try again.", 502);
  const row = d
    .insert(schema.quizzes)
    .values({ blockId, questionsJson: JSON.stringify(questions), createdAt: Date.now() })
    .returning({ id: schema.quizzes.id })
    .get();
  return { locked: false as const, quizId: row.id, questions: publicQuestions(questions) };
}

/** Grade all answers. Wrong ones go into the review queue. */
export async function submitQuiz(quizId: number, answers: string[]) {
  const d = db();
  const quiz = d.select().from(schema.quizzes).where(eq(schema.quizzes.id, quizId)).get();
  if (!quiz) throw new NotFound("quiz");
  if (quiz.finishedAt && quiz.resultsJson) {
    // Already graded (e.g. a double click): return the saved result.
    const saved = JSON.parse(quiz.resultsJson) as { results: { correct: boolean }[] };
    return { score: quiz.score ?? 0, passed: quiz.passed, passMark: PASS_MARK, results: saved.results };
  }
  const qs = JSON.parse(quiz.questionsJson) as QuizQuestion[];
  const results = await Promise.all(
    qs.map(async (q, i) => {
      const a = (answers[i] ?? "").toString().slice(0, 2000);
      if (q.type === "choice") {
        const correct = Number(a) === q.correct_index;
        return { correct, feedback: q.explain, rightAnswer: q.options[q.correct_index] };
      }
      if (!a.trim()) return { correct: false, feedback: q.explain, rightAnswer: q.answer_key };
      const g = await askJson({
        purpose: "grade-quiz",
        role: "grader",
        system: CHECK_SYSTEM,
        prompt: `Question: ${q.question}\nAnswer key: ${q.answer_key}\n\nLearner answer: ${a}`,
        shape: CheckShape,
        maxTokens: 1500,
      });
      return { correct: g.verdict === "correct", feedback: g.feedback, rightAnswer: q.answer_key };
    }),
  );
  const score = results.filter((r) => r.correct).length / qs.length;
  const passed = score >= PASS_MARK;
  d.update(schema.quizzes)
    .set({ resultsJson: JSON.stringify({ answers, results }), score, passed, finishedAt: Date.now() })
    .where(eq(schema.quizzes.id, quizId))
    .run();

  const block = blockById(quiz.blockId);
  qs.forEach((q, i) => {
    if (results[i].correct) return;
    const lessonId = block.lessonIds.includes(q.lesson) ? q.lesson : block.lessonIds[0];
    scheduleReview({
      lessonId,
      source: "quiz",
      sourceKey: `quiz:${quiz.blockId}:${normalize(q.question).slice(0, 80)}`,
      kind: q.type,
      question: q.question,
      code: q.code || null,
      options: q.type === "choice" ? q.options : undefined,
      answerKey: q.type === "choice" ? String(q.correct_index) : q.answer_key,
      context: q.explain + "\n\n" + lessonText([lessonId]),
    });
  });
  markActive();
  return { score, passed, passMark: PASS_MARK, results };
}

export function quizBlockInfo(blockId: string) {
  const block = blockById(blockId);
  const d = db();
  const titles = block.lessonIds.map((id) => d.select().from(schema.lessons).where(eq(schema.lessons.id, id)).get()?.title ?? id);
  const best = d
    .select()
    .from(schema.quizzes)
    .where(eq(schema.quizzes.blockId, blockId))
    .all()
    .reduce((m, q) => Math.max(m, q.score ?? 0), 0);
  const nextLesson = (() => {
    const list = lessonList();
    const i = list.findIndex((l) => l.id === block.lessonIds[block.lessonIds.length - 1]);
    return list[i + 1] ? { id: list[i + 1].id, title: list[i + 1].title } : null;
  })();
  return { ...block, titles, status: quizStatus(blockId), best, nextLesson };
}
