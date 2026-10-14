import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonView } from "@/components/LessonView";
import { chatHistory, lessonDetail } from "@/lib/learning";

export const dynamic = "force-dynamic";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = lessonDetail(id);
  if (!d) notFound();
  if (d.locked) {
    return (
      <main className="card">
        <h1>🔒 Not yet</h1>
        <p className="big">Finish the lessons before this one first. Each lesson builds on the last.</p>
        <Link className="btn" href="/">Back to lessons</Link>
      </main>
    );
  }
  return (
    <LessonView
      lesson={d.lesson}
      chunks={d.chunks}
      exercises={d.exercises}
      teachbackPassed={d.teachbackPassed}
      completed={d.status === "completed"}
      chunkIndex={d.chunkIndex}
      next={d.next}
      chat={chatHistory(id)}
    />
  );
}
