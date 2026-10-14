import Link from "next/link";
import { weeklyReport } from "@/lib/report";

export const dynamic = "force-dynamic";

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

export default function ReportPage() {
  const r = weeklyReport();
  const max = Math.max(1, ...r.days.map((d) => d.actions));
  const weakest = r.weakest[0];
  return (
    <main className="narrow">
      <h1>Your week</h1>
      <p className="big muted">
        {r.activeDays === 0
          ? "Nothing yet this week. A short session today starts your streak."
          : `You learned on ${r.activeDays} of the last 7 days.${r.activeDays >= 5 ? " That’s real consistency. 💪" : " Aim for every day, even 30 minutes."}`}
      </p>

      <section className="card">
        <h2>Learning activity</h2>
        <p className="muted small">Answers, code checks, reviews and quizzes per day.</p>
        <div className="chart" role="img" aria-label={`Activity per day: ${r.days.map((d) => `${d.label} ${d.actions}`).join(", ")}`}>
          {r.days.map((d) => (
            <div key={d.day} className="col" tabIndex={0}>
              <span className="tip">
                {d.label} {d.day}: {d.actions} action{d.actions === 1 ? "" : "s"}
              </span>
              {d.actions > 0 && <span className="val">{d.actions}</span>}
              <span className={`barv ${d.actions ? "" : "zero"}`} style={{ height: `${(d.actions / max) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="chart-labels" aria-hidden>
          {r.days.map((d) => (
            <span key={d.day}>{d.label}</span>
          ))}
        </div>
      </section>

      <div className="overview" style={{ marginBottom: 18 }}>
        <div className="tile">
          <div className="num">{r.lessonsCompleted.length}</div>
          <div className="label">lessons finished</div>
        </div>
        <div className="tile">
          <div className="num">{pct(r.checks.firstTryRight, r.checks.firstTry)}</div>
          <div className="label">checks right first time</div>
        </div>
        <div className="tile">
          <div className="num">{r.exercisesSolved}</div>
          <div className="label">exercises solved</div>
        </div>
        <div className="tile">
          <div className="num">{r.reviews.done ? pct(r.reviews.right, r.reviews.done) : "–"}</div>
          <div className="label">reviews remembered ({r.reviews.done})</div>
        </div>
      </div>

      <section className="card">
        <h2>Redo your weakest topic</h2>
        {weakest ? (
          <>
            <p className="big">
              Every Sunday, go back to the topic that was hardest this week. Doing it again is how it sticks.
            </p>
            <ol className="lessons" style={{ borderTop: 0, padding: 0 }}>
              {r.weakest.map((w) => (
                <li key={w.id}>
                  <span className="icon" aria-hidden>
                    ↻
                  </span>
                  <Link href={`/lesson/${w.id}`}>{w.title}</Link>
                  <span className="meta small muted">
                    {w.wrongChecks ? `${w.wrongChecks} missed check${w.wrongChecks === 1 ? "" : "s"} · ` : ""}
                    mastery {Math.round(w.mastery * 100)}%
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="big muted">No weak spots yet. Finish a few lessons and this will show what to practise.</p>
        )}
      </section>

      {(r.lessonsCompleted.length > 0 || r.quizzes.length > 0) && (
        <section className="card">
          <h2>This week’s results</h2>
          <ul>
            {r.lessonsCompleted.map((l) => (
              <li key={l.id}>
                {l.title} <span className="pill ok">{Math.round(l.mastery * 100)}%</span>
              </li>
            ))}
            {r.quizzes.map((q, k) => (
              <li key={k}>
                Quiz {q.label} <span className={`pill ${q.passed ? "ok" : "warn"}`}>{Math.round(q.score * 100)}% {q.passed ? "passed" : "try again"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="muted small">
        Teach-backs: {r.teachbacks.understood} understood of {r.teachbacks.done} · AI use this week: {(r.tokens / 1000).toFixed(1)}k tokens
        {r.cost > 0 ? ` ($${r.cost.toFixed(2)})` : ""}
      </p>
    </main>
  );
}
