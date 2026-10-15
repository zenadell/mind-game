import Link from "next/link";
import { trainOverview } from "@/lib/train";

export const dynamic = "force-dynamic";

const STATUS_ICON = { locked: "🔒", new: "▶", tried: "…", studied: "📖", solved: "✓" } as const;
const STATUS_LABEL = { locked: "locked", new: "new", tried: "in progress", studied: "studied", solved: "solved" } as const;

export default function TrainPage() {
  const t = trainOverview();
  const anyUnlocked = t.totals.unlocked > 0;
  const firstLocked = t.patterns.flatMap((p) => p.problems).find((p) => p.status === "locked");

  return (
    <main>
      <section className="hello">
        <h1>🥋 Train</h1>
        <p className="big muted">
          Real interview problems, the kind big tech companies ask, grouped by the patterns that crack them. Each one unlocks
          once you’ve finished the lessons it needs. Hard on purpose: struggle first, hints after real tries.
        </p>
      </section>

      <div className="overview">
        <div className="tile">
          <div className="num">
            {t.totals.solved}
            <span className="muted small"> / {t.totals.all}</span>
          </div>
          <div className="label">solved on your own</div>
        </div>
        {t.totals.byDifficulty.map((d) => (
          <div className="tile" key={d.difficulty}>
            <div className="num">
              {d.solved}
              <span className="muted small"> / {d.all}</span>
            </div>
            <div className="label">
              <span className={`diff diff-${d.difficulty}`}>{d.difficulty}</span>
            </div>
          </div>
        ))}
      </div>

      <h2 className="section-title">Today’s training</h2>
      <div className="plan">
        {t.next ? (
          <Link href={`/train/${t.next.id}`} className="plan-card primary">
            <span className="step-no">Next problem · {t.patterns.find((p) => p.id === t.next!.pattern)?.title}</span>
            <span className="title">{t.next.title}</span>
            <span className={`diff diff-${t.next.difficulty}`}>{t.next.difficulty}</span>
            <span className="go">{t.next.status === "tried" ? "Keep fighting →" : "Start →"}</span>
          </Link>
        ) : (
          <div className="plan-card done">
            <span className="step-no">Problems</span>
            <span className="title">{anyUnlocked ? "Everything unlocked is solved 💪" : "Nothing unlocked yet"}</span>
            <span className="muted">
              {firstLocked
                ? `Finish “${firstLocked.missing[0]?.title}” in Learn to unlock “${firstLocked.title}”.`
                : "You’ve done every problem. Try them again in interview mode."}
            </span>
          </div>
        )}
        {t.reading.unlocked ? (
          <Link href="/train/read" className="plan-card">
            <span className="step-no">Code reading</span>
            <span className="title">🔍 Read code like an engineer</span>
            <span className="muted">
              Predict the output, find the bug, or explain what it does.
              {t.reading.answered > 0 ? ` ${t.reading.right} / ${t.reading.answered} right so far.` : ""}
            </span>
            <span className="go">Read →</span>
          </Link>
        ) : (
          <div className="plan-card done">
            <span className="step-no">Code reading</span>
            <span className="title">🔒 Read code like an engineer</span>
            <span className="muted">Unlocks after the lessons on conditions, loops and functions.</span>
          </div>
        )}
      </div>

      <h2 className="section-title">Patterns</h2>
      <p className="muted">
        Interviewers don’t test whether you’ve seen a problem before. They test whether you can spot the pattern. Learn each
        pattern, then drill its problems from Easy to Hard.
      </p>
      {t.patterns.map((pt) => {
        const open = pt.problems.some((p) => p.id === t.next?.id);
        const unlocked = pt.problems.some((p) => p.status !== "locked");
        return (
          <details key={pt.id} className="card chapter" open={open}>
            <summary>
              <span className="name">
                {unlocked ? "" : "🔒 "}
                {pt.title}
              </span>
              <span className="count">
                {pt.solved}/{pt.problems.length}
              </span>
              <div className={`bar thin ${pt.solved === pt.problems.length ? "full" : ""}`}>
                <span style={{ width: `${(pt.solved / pt.problems.length) * 100}%` }} />
              </div>
            </summary>
            <p className="muted pattern-blurb">
              {pt.blurb}
            </p>
            <ol className="lessons problems">
              {pt.problems.map((p) => (
                <li key={p.id} className={p.status === "locked" ? "locked" : p.status === "solved" || p.status === "studied" ? "completed" : "available"}>
                  <span className="icon" aria-hidden>
                    {STATUS_ICON[p.status]}
                  </span>
                  {p.status === "locked" ? (
                    <span title={`Finish first: ${p.missing.map((m) => m.title).join(", ")}`}>{p.title}</span>
                  ) : (
                    <Link href={`/train/${p.id}`}>{p.title}</Link>
                  )}
                  <span className="meta">
                    <span className={`diff diff-${p.difficulty}`}>{p.difficulty}</span>
                    {p.status === "locked" ? (
                      <span className="muted small">needs: {p.missing.slice(0, 2).map((m) => m.title).join(", ")}{p.missing.length > 2 ? "…" : ""}</span>
                    ) : (
                      p.status !== "new" && <span className={`pill ${p.status === "solved" ? "ok" : p.status === "tried" ? "warn" : ""}`}>{STATUS_LABEL[p.status]}</span>
                    )}
                    {p.interviewMs && <span className="pill primary">⏱ {Math.round(p.interviewMs / 60000)} min</span>}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        );
      })}
      <p className="muted small">
        Problem statements are written for CodeTutor. Many match a classic LeetCode problem, linked on the problem page, so you can
        solve the original there too.
      </p>
    </main>
  );
}
