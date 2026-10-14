import { body, handle, type Ctx } from "@/lib/api";
import { explainChunk } from "@/lib/learning";
import type { Explain } from "@/lib/prompts";

// Short explanation + check question for one chunk. With `again`, re-explain differently.
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body<{ again?: { previous: Explain; wrongAnswers: string[] } }>(req);
  return explainChunk(Number(id), b.again);
});
