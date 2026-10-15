import { body, handle, type Ctx } from "@/lib/api";
import { hint } from "@/lib/train";

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body<{ code: string; failure?: string }>(req);
  return hint(id, String(b.code ?? ""), String(b.failure ?? ""));
});
