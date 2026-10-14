import { body, handle, type Ctx } from "@/lib/api";
import { submitAttempt } from "@/lib/learning";

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body<{ code: string; testsPassed?: boolean; testReport?: string; output?: string }>(req);
  return submitAttempt(id, b.code.slice(0, 10000), b);
});
