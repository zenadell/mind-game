import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { dayKey, lessonList, stats } from "@/lib/learning";
import { isConfigured } from "@/lib/models";
import { reviewCounts } from "@/lib/review";
import { gameState } from "@/lib/game";
import { PlayerCard } from "@/components/PlayerCard";
import { trainOverview } from "@/lib/train";

export const dynamic = "force-dynamic";

const TZ = process.env.LEARNER_TZ || "Africa/Lagos";

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function niceDay(day: string): string {
  if (day === dayKey()) return "today";
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(day + "T12:00:00Z"));
}

export default function Home() {
  const lessons = lessonList();
  if (!lessons.length) {
    return (
      <main className="narrow card">
        <h1>Welcome to CodeTutor</h1>
        <p className="big">No lessons yet. In a terminal, in the project folder, run:</p>
        <pre className="output">npm run import</pre>
        <p>Then refresh this page.</p>
      </main>
    );
  }

  const s = stats();
  const reviews = reviewCounts();
  const quiz = lessons.find((l) => l.quizAfter?.status === "available")?.quizAfter ?? null;
  const current = lessons.find((l) => l.status === "started" || l.status === "available") ?? null;
  const d = db();
  const chunkCount = current ? d.select().from(schema.chunks).where(eq(schema.chunks.lessonId, current.id)).all().length : 0;
  const position = current ? (d.select().from(schema.progress).where(eq(schema.progress.lessonId, current.id)).get()?.chunkIndex ?? 0) : 0;
  const done = lessons.filter((l) => l.status === "completed");
  const avgMastery = done.length ? Math.round((done.reduce((a, l) => a + l.mastery, 0) / done.length) * 100) : null;
  const isSunday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: TZ }).format(new Date()) === "Sunday";

  const chapters = new Map<string, typeof lessons>();
  for (const l of lessons) chapters.set(l.chapter, [...(chapters.get(l.chapter) ?? []), l]);
  const quizLesson = quiz ? lessons.find((l) => l.quizAfter?.id === quiz.id) : null;
  const train = trainOverview();

  return (
    <main>
      {!isConfigured() && (
        <div className="warn">
          <b>One step before you start:</b> the tutor needs an AI model. <Link href="/settings">Open Settings</Link> and paste your API key.
        </div>
      )}

      <section className="hello">
        <h1>
          {greeting()}
          {s.streak > 1 ? ` — ${s.streak} days in a row 🔥` : ""}
        </h1>
        <p className="big muted">Today’s plan: review first, then learn something new. 45–90 minutes is perfect.</p>
      </section>

      <PlayerCard initial={gameState()} />

      <h2 className="section-title">Today</h2>
      <div className="plan">
        {reviews.due > 0 ? (
          <Link href="/review" className="plan-card primary">
            <span className="step-no">Step 1 · Warm up</span>
            <span className="title">Review {reviews.due} question{reviews.due === 1 ? "" : "s"}</span>
            <span className="muted">Things you found tricky before. A few minutes.</span>
            <span className="go">Start review →</span>
          </Link>
        ) : (
          <div className="plan-card done">
            <span className="step-no">Step 1 · Warm up</span>
            <span className="title">No reviews due</span>
            <span className="muted">
              {reviews.nextDay ? `Next review: ${niceDay(reviews.nextDay)}.` : "Questions you miss will come back here to practise."}
            </span>
            <span className="go">✓ All caught up</span>
          </div>
        )}

        {quiz && quizLesson ? (
          <Link href={`/quiz/${quiz.id}`} className={`plan-card ${reviews.due ? "" : "primary"}`}>
            <span className="step-no">Step 2 · Boss fight</span>
            <span className="title">A boss guards the next lessons</span>
            <span className="muted">6 questions. Bring it to 30% health to unlock what comes next.</span>
            <span className="go">⚔️ Fight →</span>
          </Link>
        ) : current ? (
          <Link href={`/lesson/${current.id}`} className={`plan-card ${reviews.due ? "" : "primary"}`}>
            <span className="step-no">Step 2 · {current.status === "started" ? "Keep going" : "New lesson"}</span>
            <span className="title">{current.title}</span>
            <span className="muted">{current.chapter}</span>
            {current.status === "started" && chunkCount > 0 && (
              <div className="bar thin" aria-label={`Step ${position + 1} of ${chunkCount}`}>
                <span style={{ width: `${Math.round((position / chunkCount) * 100)}%` }} />
              </div>
            )}
            <span className="go">{current.status === "started" ? "Continue →" : "Start →"}</span>
          </Link>
        ) : (
          <div className="plan-card done">
            <span className="title">🎓 You finished every lesson!</span>
          </div>
        )}

        {train.next ? (
          <Link href={`/train/${train.next.id}`} className="plan-card">
            <span className="step-no">Step 3 · Train</span>
            <span className="title">🥋 {train.next.title}</span>
            <span className="muted">
              A real interview problem ({train.next.difficulty}) using what you’ve learned. {train.totals.solved} solved so far.
            </span>
            <span className="go">Solve it →</span>
          </Link>
        ) : train.reading.unlocked ? (
          <Link href="/train/read" className="plan-card">
            <span className="step-no">Step 3 · Train</span>
            <span className="title">🔍 Code reading</span>
            <span className="muted">Predict the output, find the bug, explain the code.</span>
            <span className="go">Read →</span>
          </Link>
        ) : null}

        <Link href="/report" className={`plan-card ${isSunday ? "primary" : ""}`}>
          <span className="step-no">{isSunday ? "It’s Sunday" : "Any time"}</span>
          <span className="title">Your weekly report</span>
          <span className="muted">{isSunday ? "See your week and redo your weakest topic." : "See how your week is going."}</span>
          <span className="go">Open report →</span>
        </Link>
      </div>

      <h2 className="section-title">Progress</h2>
      <div className="overview">
        <div className="tile">
          <div className="num">
            {done.length}
            <span className="muted small"> / {lessons.length}</span>
          </div>
          <div className="label">lessons done</div>
        </div>
        <div className="tile">
          <div className="num">{avgMastery === null ? "–" : `${avgMastery}%`}</div>
          <div className="label">average mastery</div>
        </div>
        <div className="tile">
          <div className="num">{s.streak}</div>
          <div className="label">day streak</div>
        </div>
        <div className="tile">
          <div className="num">{reviews.due + reviews.upcoming}</div>
          <div className="label">questions in review</div>
        </div>
      </div>

      <h2 className="section-title">Your path · JavaScript fundamentals</h2>
      {[...chapters].map(([chapter, ls]) => {
        const n = ls.filter((l) => l.status === "completed").length;
        const isCurrent = ls.some((l) => l.id === current?.id) || ls.some((l) => l.quizAfter?.id === quiz?.id);
        return (
          <details key={chapter} className="card chapter" open={isCurrent}>
            <summary>
              <span className="name">{chapter}</span>
              <span className="count">
                {n}/{ls.length}
              </span>
              <div className={`bar thin ${n === ls.length ? "full" : ""}`}>
                <span style={{ width: `${(n / ls.length) * 100}%` }} />
              </div>
            </summary>
            <ol className="lessons">
              {ls.map((l) => (
                <LessonRow key={l.id} l={l} isCurrent={l.id === current?.id && !quiz} />
              ))}
            </ol>
          </details>
        );
      })}
    </main>
  );
}

function LessonRow({ l, isCurrent }: { l: ReturnType<typeof lessonList>[number]; isCurrent: boolean }) {
  const icon = l.status === "completed" ? "✓" : l.status === "locked" ? "🔒" : "▶";
  return (
    <>
      <li className={`${l.status} ${isCurrent ? "current" : ""}`}>
        <span className="icon" aria-hidden>
          {icon}
        </span>
        {l.status === "locked" ? <span>{l.title}</span> : <Link href={`/lesson/${l.id}`}>{l.title}</Link>}
        <span className="meta">
          {l.status === "completed" && <span className="pill ok">{Math.round(l.mastery * 100)}%</span>}
          {isCurrent && <span className="pill primary">{l.status === "started" ? "in progress" : "next"}</span>}
        </span>
      </li>
      {l.quizAfter && (
        <li className={`quiz ${l.quizAfter.status}`}>
          <span className="icon" aria-hidden>
            {l.quizAfter.status === "passed" ? "✓" : l.quizAfter.status === "locked" ? "?" : "★"}
          </span>
          {l.quizAfter.status === "locked" ? (
            <span className="muted">⚔️ Boss fight: the lessons above</span>
          ) : (
            <Link href={`/quiz/${l.quizAfter.id}`}>⚔️ Boss fight: the lessons above</Link>
          )}
          <span className="meta">
            {l.quizAfter.status === "available" && <span className="pill warn">ready</span>}
            {l.quizAfter.status === "passed" && <span className="pill ok">passed</span>}
          </span>
        </li>
      )}
    </>
  );
}
