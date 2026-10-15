import { body, handle } from "@/lib/api";
import { nextReading } from "@/lib/train";

export const dynamic = "force-dynamic";

/** The open code-reading challenge, or a new one ({ fresh: true } skips the open one). */
export const POST = handle(async (req: Request) => {
  const b = await body<{ fresh?: boolean }>(req).catch(() => ({ fresh: false }));
  return nextReading(!!b.fresh);
});
