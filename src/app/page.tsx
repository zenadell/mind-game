import Link from "next/link";
import { lessonList, stats } from "@/lib/learning";
import { isConfigured } from "@/lib/models";

export const dynamic = "force-dynamic";

const ICON: Record<string, string> = { completed: "✔", started: "▶", available: "○", locked: "🔒" };

export default function Home() {
  const lessons = lessonList();
  if (!lessons.length) {
    return (
      <main className="card">
        <h1>Welcome!</h1>
        <p className="big">No lessons yet. In a terminal, run:</p>
        <pre className="output">npm run import</pre>
        <p>Then refresh this page.</p>
      </main>
    );
  }
  const s = stats();
  const current = lessons.find((l) => l.status === "started" || l.status === "available");
  const chapters = new Map<string, typeof lessons>();
  for (const l of lessons) chapters.set(l.chapter, [...(chapters.get(l.chapter) ?? []), l]);
  const keyMissing = !isConfigured();

  return (
    <main>
      {keyMissing && (
        <p className="error card">
          The tutor needs an AI model. <Link href="/settings">Open ⚙️ Settings</Link> and add your API key.
        </p>
      )}
      <section className="card hero">
        <h1>{s.completed === 0 ? "Let’s start learning JavaScript" : "Welcome back!"}</h1>
        <p className="big">
          One small idea at a time. Each step: read (or listen), try the code, answer one question. Then explain it back and practise.
        </p>
        <p className="muted">Aim for 45–90 minutes every day. Consistency beats long sessions.</p>
        {current && (
          <Link className="btn big-btn" href={`/lesson/${current.id}`}>
            {current.status === "started" ? "Continue" : "Start"}: {current.title} →
          </Link>
        )}
      </section>

      {[...chapters].map(([chapter, ls]) => {
        const done = ls.filter((l) => l.status === "completed").length;
        return (
          <section key={chapter} className="card chapter">
            <h2>
              {chapter} <small className="muted">{done}/{ls.length}</small>
            </h2>
            <ol className="lessons">
              {ls.map((l) => (
                <li key={l.id} className={l.status}>
                  <span className="icon">{ICON[l.status]}</span>
                  {l.status === "locked" ? (
                    <span>{l.title}</span>
                  ) : (
                    <Link href={`/lesson/${l.id}`}>{l.title}</Link>
                  )}
                  {l.status === "completed" && <small className="muted"> mastery {Math.round(l.mastery * 100)}%</small>}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </main>
  );
}
