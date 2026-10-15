import { body, handle, type Ctx } from "@/lib/api";
import { answerReading } from "@/lib/train";

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body<{ choice?: number; text?: string }>(req);
  return answerReading(Number(id), b);
});
