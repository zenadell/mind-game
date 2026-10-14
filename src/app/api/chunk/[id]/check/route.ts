import { body, handle, type Ctx } from "@/lib/api";
import { gradeCheck } from "@/lib/learning";

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body<{ question: string; answerKey: string; answer: string }>(req);
  return gradeCheck(Number(id), b.question, b.answerKey, b.answer.slice(0, 2000));
});
