import { desc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { TZ, currentStreak, dayKey, freezes, markActive } from "./core";

export { currentStreak, freezes };

// The game layer: XP for every learning action, levels with names, a daily goal,
// combos for first-try answers, achievements, and streak freezes. Everything that
// pays XP is a real learning action, so playing the game means learning.

export const XP = {
  read: 5, // finished reading a part
  guessTry: 2, // made a prediction before reading
  guessRight: 10, // ...and it was right
  checkFirstTry: 20, // check question right on the first try (combo applies)
  checkLater: 10, // right after a follow-up
  reviewRight: 10,
  reviewTry: 2,
  exercise: 50,
  exerciseClean: 20, // bonus: no hints, no solution
  teachback: 40,
  lesson: 100,
  quizRight: 10, // per right answer in a boss fight
  quizWin: 150,
  // Train
  problemEasy: 60,
  problemMedium: 120,
  problemHard: 250,
  problemClean: 40, // bonus: solved without hints
  problemStudied: 20, // rebuilt it after studying the solution
  interview: 60, // solved in interview mode, in time
  complexity: 30, // explained the time and space complexity
  patternDone: 100, // solved every problem of a pattern
  readingTry: 3,
  readingRight: 25,
} as const;

const LEVEL_NAMES = [
  "Rookie",
  "Curious Mind",
  "Script Kid",
  "Code Explorer",
  "Bug Hunter",
  "Logic Builder",
  "Loop Master",
  "Function Wizard",
  "Problem Solver",
  "Web Crafter",
  "Code Ninja",
  "Junior Developer",
  "Developer",
  "Senior Developer",
  "Engineer",
];

/** Total XP needed to reach level n (1-based): 0, 100, 300, 600, 1000, 1500, ... */
export function xpForLevel(n: number): number {
  return 50 * (n - 1) * n;
}

export function levelOf(total: number) {
  let n = 1;
  while (total >= xpForLevel(n + 1)) n++;
  const start = xpForLevel(n);
  return {
    n,
    name: LEVEL_NAMES[n - 1] ?? `Legend ${n - LEVEL_NAMES.length}`,
    into: total - start,
    need: xpForLevel(n + 1) - start,
  };
}

// ---------- Small stored values ----------

function getSetting(key: string, fallback: number): number {
  const row = db().select().from(schema.settings).where(eq(schema.settings.key, key)).get();
  return row ? Number(row.value) : fallback;
}
function setSetting(key: string, value: number) {
  const row = { key, value: String(value) };
  db().insert(schema.settings).values(row).onConflictDoUpdate({ target: schema.settings.key, set: row }).run();
}

export const GOALS = [50, 100, 200] as const;
export const dailyGoal = () => getSetting("game.goal", 100);
export function setDailyGoal(n: number) {
  setSetting("game.goal", GOALS.includes(n as (typeof GOALS)[number]) ? n : 100);
}

// ---------- Combo: first-try answers in a row ----------

export const comboNow = () => getSetting("game.combo", 0);
export function comboHit(): number {
  const c = comboNow() + 1;
  setSetting("game.combo", c);
  setSetting("game.comboBest", Math.max(c, getSetting("game.comboBest", 0)));
  return c;
}
export const comboBreak = () => setSetting("game.combo", 0);
/** x1 for 0-2 in a row, x2 from 3, x3 from 6. */
export const comboMultiplier = (c: number) => (c >= 6 ? 3 : c >= 3 ? 2 : 1);

// ---------- Totals ----------

function totalXp(): number {
  return db().select({ t: sql<number>`coalesce(sum(${schema.xpEvents.amount}), 0)` }).from(schema.xpEvents).get()!.t;
}

function todayXp(): number {
  const since = Date.now() - 36 * 3600_000;
  const today = dayKey();
  return db()
    .select()
    .from(schema.xpEvents)
    .where(gte(schema.xpEvents.createdAt, since))
    .all()
    .filter((e) => dayKey(e.createdAt) === today)
    .reduce((a, e) => a + e.amount, 0);
}

// ---------- Achievements ----------

type Badge = { id: string; emoji: string; title: string; desc: string };

export const BADGES: Badge[] = [
  { id: "first-step", emoji: "👣", title: "First Step", desc: "Earned your first XP." },
  { id: "sharp", emoji: "🎯", title: "Sharp Instinct", desc: "Guessed right 5 times before reading." },
  { id: "on-fire", emoji: "🔥", title: "On Fire", desc: "5 first-try answers in a row." },
  { id: "unstoppable", emoji: "⚡", title: "Unstoppable", desc: "10 first-try answers in a row." },
  { id: "first-code", emoji: "💻", title: "First Real Code", desc: "Solved your first exercise." },
  { id: "no-hints", emoji: "🧠", title: "No Hints Needed", desc: "Solved an exercise without hints." },
  { id: "teacher", emoji: "🗣️", title: "Natural Teacher", desc: "Passed 3 teach-backs." },
  { id: "lesson-1", emoji: "📗", title: "Lesson One", desc: "Completed your first lesson." },
  { id: "lesson-10", emoji: "📚", title: "Bookworm", desc: "Completed 10 lessons." },
  { id: "boss-1", emoji: "⚔️", title: "Boss Slayer", desc: "Defeated your first boss." },
  { id: "memory", emoji: "🧩", title: "Memory Master", desc: "Remembered 25 review questions." },
  { id: "goal", emoji: "🎉", title: "Goal Getter", desc: "Hit your daily goal." },
  { id: "streak-3", emoji: "🔥", title: "3-Day Streak", desc: "Learned 3 days in a row." },
  { id: "streak-7", emoji: "🌟", title: "Week Warrior", desc: "Learned 7 days in a row." },
  { id: "streak-30", emoji: "👑", title: "Unbreakable", desc: "Learned 30 days in a row." },
  { id: "level-5", emoji: "🐞", title: "Bug Hunter", desc: "Reached level 5." },
  { id: "night-owl", emoji: "🦉", title: "Night Owl", desc: "Learned after 10 pm." },
  { id: "early-bird", emoji: "🐦", title: "Early Bird", desc: "Learned before 7 am." },
  { id: "solve-1", emoji: "🥋", title: "Into the Dojo", desc: "Solved your first training problem." },
  { id: "solve-10", emoji: "🪨", title: "Rock Solid", desc: "Solved 10 training problems on your own." },
  { id: "solve-25", emoji: "🏋️", title: "Iron Will", desc: "Solved 25 training problems on your own." },
  { id: "hard-1", emoji: "🏔️", title: "Summit", desc: "Solved a Hard problem." },
  { id: "pattern-1", emoji: "🧩", title: "Pattern Master", desc: "Solved every problem in a pattern." },
  { id: "interview-1", emoji: "⏱️", title: "Interview Ready", desc: "Beat the interview clock." },
  { id: "big-o", emoji: "📈", title: "Big-O Brain", desc: "Explained the complexity of 5 solutions." },
  { id: "reader-10", emoji: "🔍", title: "Code Reader", desc: "Got 10 code-reading challenges right." },
];

function countKind(kind: string): number {
  return db().select({ n: sql<number>`count(*)` }).from(schema.xpEvents).where(eq(schema.xpEvents.kind, kind)).get()!.n;
}

/** Which badges are earned now (checked after each XP award). */
function earnedNow(ctx: { total: number; combo: number; goalHit: boolean }): string[] {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(new Date()));
  const streak = currentStreak();
  const ids: string[] = [];
  const add = (id: string, ok: boolean) => ok && ids.push(id);
  add("first-step", ctx.total > 0);
  add("sharp", countKind("guessRight") >= 5);
  add("on-fire", ctx.combo >= 5);
  add("unstoppable", ctx.combo >= 10);
  add("first-code", countKind("exercise") >= 1);
  add("no-hints", countKind("exerciseClean") >= 1);
  add("teacher", countKind("teachback") >= 3);
  add("lesson-1", countKind("lesson") >= 1);
  add("lesson-10", countKind("lesson") >= 10);
  add("boss-1", countKind("quizWin") >= 1);
  add("memory", countKind("reviewRight") >= 25);
  add("goal", ctx.goalHit);
  add("streak-3", streak >= 3);
  add("streak-7", streak >= 7);
  add("streak-30", streak >= 30);
  add("level-5", levelOf(ctx.total).n >= 5);
  add("night-owl", hour >= 22);
  add("early-bird", hour < 7 && hour >= 4);
  const solves = countKind("problemEasy") + countKind("problemMedium") + countKind("problemHard");
  add("solve-1", solves + countKind("problemStudied") >= 1);
  add("solve-10", solves >= 10);
  add("solve-25", solves >= 25);
  add("hard-1", countKind("problemHard") >= 1);
  add("pattern-1", countKind("patternDone") >= 1);
  add("interview-1", countKind("interview") >= 1);
  add("big-o", countKind("complexity") >= 5);
  add("reader-10", countKind("readingRight") >= 10);
  return ids;
}

// ---------- Awarding XP ----------

export type GameEvent = {
  gained: number;
  label: string;
  total: number;
  level: ReturnType<typeof levelOf>;
  leveledUp: { n: number; name: string } | null;
  daily: { xp: number; goal: number };
  goalReached: boolean;
  combo: number;
  multiplier: number;
  badges: Badge[];
};

/**
 * Give XP for a learning action. `key` makes it pay only once (e.g. reading a part).
 * `combo` applies the current combo multiplier. Returns what happened, for the celebration.
 */
export function award(kind: keyof typeof XP, label: string, opts: { key?: string; combo?: boolean; amount?: number } = {}): GameEvent | null {
  const d = db();
  if (opts.key && d.select().from(schema.xpEvents).where(eq(schema.xpEvents.key, opts.key)).get()) return null;
  const before = totalXp();
  const goal = dailyGoal();
  const dayBefore = todayXp();
  const combo = comboNow();
  const multiplier = opts.combo ? comboMultiplier(combo) : 1;
  const gained = (opts.amount ?? XP[kind]) * multiplier;
  d.insert(schema.xpEvents).values({ kind, key: opts.key ?? null, amount: gained, label, createdAt: Date.now() }).run();
  markActive();

  const total = before + gained;
  const dayAfter = dayBefore + gained;
  const goalReached = dayBefore < goal && dayAfter >= goal;
  const lvBefore = levelOf(before);
  const level = levelOf(total);

  const have = new Set(d.select().from(schema.badges).all().map((b) => b.id));
  const fresh = earnedNow({ total, combo, goalHit: dayAfter >= goal }).filter((id) => !have.has(id));
  for (const id of fresh) d.insert(schema.badges).values({ id, earnedAt: Date.now() }).onConflictDoNothing().run();

  return {
    gained,
    label,
    total,
    level,
    leveledUp: level.n > lvBefore.n ? { n: level.n, name: level.name } : null,
    daily: { xp: dayAfter, goal },
    goalReached,
    combo,
    multiplier,
    badges: BADGES.filter((b) => fresh.includes(b.id)),
  };
}

/** Several awards from one action, merged into one celebration. */
export function mergeEvents(events: (GameEvent | null)[]): GameEvent | null {
  const real = events.filter((e): e is GameEvent => !!e);
  if (!real.length) return null;
  const last = real[real.length - 1];
  return {
    ...last,
    gained: real.reduce((a, e) => a + e.gained, 0),
    label: real.map((e) => e.label).join(" · "),
    leveledUp: real.find((e) => e.leveledUp)?.leveledUp ?? null,
    goalReached: real.some((e) => e.goalReached),
    badges: real.flatMap((e) => e.badges),
  };
}

/** Everything the screen shows about the game. */
export function gameState() {
  const total = totalXp();
  const earned = new Map(db().select().from(schema.badges).all().map((b) => [b.id, b.earnedAt]));
  const recent = db().select().from(schema.xpEvents).orderBy(desc(schema.xpEvents.id)).limit(1).get();
  return {
    total,
    level: levelOf(total),
    daily: { xp: todayXp(), goal: dailyGoal() },
    combo: comboNow(),
    comboBest: getSetting("game.comboBest", 0),
    streak: currentStreak(),
    freezes: freezes(),
    badges: BADGES.map((b) => ({ ...b, earnedAt: earned.get(b.id) ?? null })),
    lastXpAt: recent?.createdAt ?? null,
  };
}
