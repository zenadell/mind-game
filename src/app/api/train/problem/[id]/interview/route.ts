import { body, handle, type Ctx } from "@/lib/api";
import { interview } from "@/lib/train";

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body<{ action: "start" | "stop" }>(req);
  return interview(id, b.action === "start" ? "start" : "stop");
});
