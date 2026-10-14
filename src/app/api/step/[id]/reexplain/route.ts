import { body, handle, type Ctx } from "@/lib/api";
import { reexplainStep } from "@/lib/steps";

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body<{ wrongAnswers: string[] }>(req);
  return reexplainStep(Number(id), (b.wrongAnswers ?? []).map(String).slice(0, 5));
});
