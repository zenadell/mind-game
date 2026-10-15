import { handle, type Ctx } from "@/lib/api";
import { sectionHelp } from "@/lib/steps";

// The tutor's help for one section (written the first time, then saved).
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return sectionHelp(Number(id));
});
