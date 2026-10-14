import { handle } from "@/lib/api";
import { stats } from "@/lib/learning";

export const dynamic = "force-dynamic";
export const GET = handle(async () => stats());
