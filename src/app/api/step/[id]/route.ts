import { handle, type Ctx } from "@/lib/api";
import { stepContent } from "@/lib/steps";

// The deep content of one step (written the first time, then saved).
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return stepContent(Number(id));
});
