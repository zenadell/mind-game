import { body, handle } from "@/lib/api";
import { award, gameState, mergeEvents, setDailyGoal } from "@/lib/game";
import { sectionHelp } from "@/lib/steps";

export const dynamic = "force-dynamic";

export const GET = handle(async () => gameState());

/** Small game actions: finished reading a part, guessed a puzzle, changed the daily goal. */
export const POST = handle(async (req: Request) => {
  const b = await body<{ action: "read" | "guess" | "goal"; stepId?: number; choice?: number; goal?: number }>(req);
  if (b.action === "goal") {
    setDailyGoal(Number(b.goal));
    return { state: gameState() };
  }
  const stepId = Number(b.stepId);
  if (b.action === "read") return { game: award("read", "Part read", { key: `read:${stepId}` }) };
  // A guess: checked on the server against the puzzle's answer.
  const help = await sectionHelp(stepId);
  const right = !!help.hook && Number(b.choice) === help.hook.correct_index;
  const game = mergeEvents([
    award("guessTry", "Brave guess", { key: `guess:${stepId}` }),
    right ? award("guessRight", "Sharp instinct!", { key: `guessright:${stepId}` }) : null,
  ]);
  return { right, correct: help.hook?.correct_index ?? null, game };
});
