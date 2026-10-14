import { body, handle, type Ctx } from "@/lib/api";
import { gradeCheck } from "@/lib/learning";
import { scheduleFromCheck } from "@/lib/review";

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body<{ question: string; answerKey: string; answer: string }>(req);
  const res = await gradeCheck(Number(id), b.question, b.answerKey, b.answer.slice(0, 2000));
  if (res.verdict !== "correct") scheduleFromCheck(Number(id), b.question, b.answerKey);
  return res;
});
