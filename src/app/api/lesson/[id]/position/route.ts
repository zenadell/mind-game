import { body, handle, type Ctx } from "@/lib/api";
import { savePosition } from "@/lib/learning";

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body<{ chunkIndex: number }>(req);
  savePosition(id, Math.max(0, Math.floor(b.chunkIndex)));
  return { ok: true };
});
