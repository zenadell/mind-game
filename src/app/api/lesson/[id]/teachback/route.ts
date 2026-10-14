import { body, handle, type Ctx } from "@/lib/api";
import { gradeTeachback, tryComplete } from "@/lib/learning";

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body<{ text: string }>(req);
  const res = await gradeTeachback(id, b.text.slice(0, 4000));
  return { ...res, completion: tryComplete(id) };
});
