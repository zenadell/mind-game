import { handle, type Ctx } from "@/lib/api";
import { primer } from "@/lib/train";

export const POST = handle(async (_req: Request, { params }: Ctx) => ({ content: await primer((await params).id) }));
