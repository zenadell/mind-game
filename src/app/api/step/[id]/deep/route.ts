import { handle, type Ctx } from "@/lib/api";
import { deepSection } from "@/lib/steps";

// "Teach me this from zero": the tutor's full explanation of the section.
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return deepSection(Number(id));
});
