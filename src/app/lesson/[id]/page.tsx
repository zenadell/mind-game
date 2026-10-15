import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonView } from "@/components/LessonView";
import { chatHistory, lessonDetail, lessonList } from "@/lib/learning";

export const dynamic = "force-dynamic";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = lessonDetail(id);
  if (!d) notFound();
  if (d.locked) {
    // Point to whatever is next on the path: an open quiz or the next lesson.
    const list = lessonList();
    const quiz = list.find((l) => l.quizAfter?.status === "available")?.quizAfter;
    const lesson = list.find((l) => l.status === "started" || l.status === "available");
    return (
      <main className="narrow card">
        <h1>🔒 Not yet</h1>
        <p className="big">
          {quiz
            ? "First pass the quiz on your last lessons. Then this lesson opens."
            : "Finish the lessons before this one first. Each lesson builds on the last."}
        </p>
        <div className="row">
          {quiz ? (
            <Link className="btn" href={`/quiz/${quiz.id}`}>Take the quiz →</Link>
          ) : lesson ? (
            <Link className="btn" href={`/lesson/${lesson.id}`}>Go to: {lesson.title} →</Link>
          ) : null}
          <Link className="btn secondary" href="/">All lessons</Link>
        </div>
      </main>
    );
  }
  return (
    <LessonView
      lesson={d.lesson}
      steps={d.steps}
      odin={d.odin}
      goals={d.goals}
      reading={d.reading}
      exercises={d.exercises}
      teachbackPassed={d.teachbackPassed}
      completed={d.status === "completed"}
      chunkIndex={d.chunkIndex}
      next={d.next}
      quizAfter={d.quizAfter}
      chat={chatHistory(id)}
    />
  );
}
