import Link from "next/link";
import { notFound } from "next/navigation";
import { ProblemWorkspace } from "@/components/ProblemWorkspace";
import { NotFound } from "@/lib/core";
import { trainOverview, problemView } from "@/lib/train";

export const dynamic = "force-dynamic";

export default async function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let view;
  try {
    view = problemView(id);
  } catch (e) {
    if (e instanceof NotFound) notFound();
    throw e;
  }
  const { problem: p, locked } = view;
  if (locked) {
    return (
      <main className="narrow">
        <p className="crumbs">
          <Link href="/train">← Train</Link> · {p.pattern.title}
        </p>
        <h1>🔒 {p.title}</h1>
        <div className="card">
          <p className="big">This problem unlocks when you’ve learned everything it needs. Finish these lessons first:</p>
          <ul className="checklist">
            {p.requires.map((r) => (
              <li key={r.id} className={r.done ? "done" : ""}>
                {r.done ? "✓ " : "○ "}
                {r.done ? r.title : <Link href={`/lesson/${r.id}`}>{r.title}</Link>}
              </li>
            ))}
          </ul>
        </div>
      </main>
    );
  }
  // The next problem to go to after this one.
  const all = trainOverview().patterns.flatMap((x) => x.problems);
  const after = all.slice(all.findIndex((x) => x.id === p.id) + 1).find((x) => x.status === "new" || x.status === "tried") ?? null;
  return (
    <main>
      <p className="crumbs">
        <Link href="/train">← Train</Link> · {p.pattern.title}
      </p>
      <ProblemWorkspace view={view} next={after ? { id: after.id, title: after.title } : null} />
    </main>
  );
}
