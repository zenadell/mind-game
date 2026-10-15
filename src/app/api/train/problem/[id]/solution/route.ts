import { handle, type Ctx } from "@/lib/api";
import { solution } from "@/lib/train";

export const POST = handle(async (_req: Request, { params }: Ctx) => solution((await params).id));
