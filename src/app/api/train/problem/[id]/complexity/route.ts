import { body, handle, type Ctx } from "@/lib/api";
import { complexity } from "@/lib/train";

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body<{ answer: string }>(req);
  return complexity(id, String(b.answer ?? ""));
});
