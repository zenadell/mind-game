import { handle, type Ctx } from "@/lib/api";
import { revealSolution } from "@/lib/learning";

export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return revealSolution(id);
});
