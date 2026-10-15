import { handle } from "@/lib/api";
import { explainCode } from "@/lib/steps";

// Line-by-line explanation of the n-th code example in a section.
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string; n: string }> }) => {
  const { id, n } = await params;
  return explainCode(Number(id), Number(n));
});
