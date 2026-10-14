import { db, schema } from "@/db";

// Small shared helpers, kept separate so other modules can use them without import cycles.

export const TZ = process.env.LEARNER_TZ || "Africa/Lagos";

/** YYYY-MM-DD in the learner's time zone. */
export function dayKey(t = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
}

/** Remember that the learner did something today (for the streak). */
export function markActive() {
  db().insert(schema.activity).values({ day: dayKey() }).onConflictDoNothing().run();
}

export class NotFound extends Error {
  constructor(what: string) {
    super(`${what} not found`);
  }
}
