import { body, handle, type Ctx } from "@/lib/api";
import { gradeSolutionExplanation } from "@/lib/learning";

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body<{ code: string; explanation: string }>(req);
  return gradeSolutionExplanation(id, b.code.slice(0, 10000), b.explanation.slice(0, 4000));
});
