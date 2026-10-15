import { body, handle, type Ctx } from "@/lib/api";
import { XP, award, comboBreak, comboHit } from "@/lib/game";
import { scheduleReview } from "@/lib/review";
import { gradeStepCheck, type Turn } from "@/lib/steps";

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body<{ question: string; answerKey: string; answer: string; history?: Turn[] }>(req);
  const history = (b.history ?? [])
    .slice(-6)
    .map((t) => ({ who: t.who === "tutor" ? ("tutor" as const) : ("learner" as const), text: String(t.text).slice(0, 1000) }));
  const { lessonId, context, ...res } = await gradeStepCheck(Number(id), b.question, b.answerKey, b.answer.slice(0, 2000), history);
  let game = null;
  if (res.verdict === "correct") {
    // Right on the first try builds the combo (and its multiplier); a later right answer still pays.
    const firstTry = !history.some((t) => t.who === "learner");
    if (firstTry) comboHit();
    game = award(firstTry ? "checkFirstTry" : "checkLater", firstTry ? "Right first time" : "Got it", {
      key: `check:${id}`,
      combo: firstTry,
      amount: firstTry ? XP.checkFirstTry : XP.checkLater,
    });
  } else {
    comboBreak();
    // Missed (or only partly right): it comes back in tomorrow's review.
    scheduleReview({ lessonId, source: "check", sourceKey: `step:${id}`, kind: "short", question: b.question, answerKey: b.answerKey, context });
  }
  return { ...res, game };
});
