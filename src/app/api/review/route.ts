import { handle } from "@/lib/api";
import { dueReviews, reviewCounts } from "@/lib/review";

export const dynamic = "force-dynamic";
export const GET = handle(async () => ({ items: dueReviews(), counts: reviewCounts() }));
