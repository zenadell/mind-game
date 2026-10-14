import { body, handle, type Ctx } from "@/lib/api";
import { answerReview } from "@/lib/review";

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body<{ answer: string }>(req);
  return answerReview(Number(id), String(b.answer).slice(0, 2000));
});
