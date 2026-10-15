import Link from "next/link";
import { ReadingRunner } from "@/components/ReadingRunner";

export const dynamic = "force-dynamic";

export default function ReadPage() {
  return (
    <main className="narrow">
      <p className="crumbs">
        <Link href="/train">← Train</Link>
      </p>
      <h1>🔍 Code reading</h1>
      <p className="big muted">
        Engineers read far more code than they write. Each challenge uses only what you’ve learned: predict what it prints, find
        the bug, or explain what it does.
      </p>
      <ReadingRunner />
    </main>
  );
}
