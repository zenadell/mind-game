import { body, handle, type Ctx } from "@/lib/api";
import { scheduleReview } from "@/lib/review";
import { gradeStepCheck } from "@/lib/steps";

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body<{ question: string; answerKey: string; answer: string }>(req);
  const { lessonId, context, ...res } = await gradeStepCheck(Number(id), b.question, b.answerKey, b.answer.slice(0, 2000));
  // Missed (or only partly right): it comes back in tomorrow's review.
  if (res.verdict !== "correct") {
    scheduleReview({ lessonId, source: "check", sourceKey: `step:${id}`, kind: "short", question: b.question, answerKey: b.answerKey, context });
  }
  return res;
});
