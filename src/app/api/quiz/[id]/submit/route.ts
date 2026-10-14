import { body, handle, type Ctx } from "@/lib/api";
import { submitQuiz } from "@/lib/quiz";

export const POST = handle(async (req: Request, { params }: Ctx) => {
  await params;
  const b = await body<{ quizId: number; answers: string[] }>(req);
  return submitQuiz(Number(b.quizId), Array.isArray(b.answers) ? b.answers.map(String) : []);
});
