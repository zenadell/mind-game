import { handle } from "@/lib/api";
import { stats } from "@/lib/learning";
import { reviewCounts } from "@/lib/review";

export const dynamic = "force-dynamic";
export const GET = handle(async () => ({ ...stats(), reviewsDue: reviewCounts().due }));
