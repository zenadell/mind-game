import { body, handle, type Ctx } from "@/lib/api";
import { giveHint } from "@/lib/learning";

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body<{ code: string }>(req);
  return giveHint(id, b.code.slice(0, 10000));
});
