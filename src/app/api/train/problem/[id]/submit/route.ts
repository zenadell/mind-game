import { body, handle, type Ctx } from "@/lib/api";
import { submit } from "@/lib/train";

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body<{ code: string; passed: boolean }>(req);
  return submit(id, String(b.code ?? ""), !!b.passed);
});
