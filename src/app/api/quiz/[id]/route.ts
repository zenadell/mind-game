import { handle, type Ctx } from "@/lib/api";
import { startQuiz } from "@/lib/quiz";

/** Start (or resume) the quiz for a block. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return startQuiz(id);
});
