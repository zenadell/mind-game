import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

// Small shared helpers, kept separate so other modules can use them without import cycles.

export const TZ = process.env.LEARNER_TZ || "Africa/Lagos";

/** YYYY-MM-DD in the learner's time zone. */
export function dayKey(t = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
}

function shiftDay(day: string, n: number): string {
  const x = new Date(day + "T12:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

function setting(key: string, fallback: number): number {
  const row = db().select().from(schema.settings).where(eq(schema.settings.key, key)).get();
  return row ? Number(row.value) : fallback;
}
function saveSetting(key: string, value: number) {
  const row = { key, value: String(value) };
  db().insert(schema.settings).values(row).onConflictDoUpdate({ target: schema.settings.key, set: row }).run();
}

/** Streak freezes held (each covers one missed day). */
export const freezes = () => setting("game.freezes", 0);

function activeOn(day: string): boolean {
  const d = db();
  return (
    !!d.select().from(schema.activity).where(eq(schema.activity.day, day)).get() ||
    !!d.select().from(schema.freezeDays).where(eq(schema.freezeDays.day, day)).get()
  );
}

/** Days in a row with activity, counting today (or up to yesterday if not yet active today).
 *  Missed days covered by a freeze count as kept. */
export function currentStreak(today = dayKey()): number {
  let day = activeOn(today) ? today : shiftDay(today, -1);
  let n = 0;
  while (activeOn(day)) {
    n++;
    day = shiftDay(day, -1);
  }
  return n;
}

/**
 * Remember that the learner did something today. On the first activity of a day: if exactly
 * one day was missed and a freeze is available, it covers that day so the streak survives.
 * Every 7 days of streak earns a freeze (you can hold 2).
 */
export function markActive(today = dayKey()) {
  const d = db();
  if (d.select().from(schema.activity).where(eq(schema.activity.day, today)).get()) return;
  const yesterday = shiftDay(today, -1);
  if (!activeOn(yesterday) && activeOn(shiftDay(today, -2)) && freezes() > 0) {
    d.insert(schema.freezeDays).values({ day: yesterday }).onConflictDoNothing().run();
    saveSetting("game.freezes", freezes() - 1);
  }
  d.insert(schema.activity).values({ day: today }).onConflictDoNothing().run();
  const s = currentStreak(today);
  if (s > 0 && s % 7 === 0) saveSetting("game.freezes", Math.min(2, freezes() + 1));
}

export class NotFound extends Error {
  constructor(what: string) {
    super(`${what} not found`);
  }
}
