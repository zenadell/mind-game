import { handle, type Ctx } from "@/lib/api";
import { lessonDetail } from "@/lib/learning";
import { planLesson } from "@/lib/steps";

// Plan the lesson's steps (once), from javascript.info + The Odin Project.
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await planLesson(id);
  return { steps: lessonDetail(id)?.steps ?? [] };
});
