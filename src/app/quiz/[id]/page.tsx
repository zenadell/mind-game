import Link from "next/link";
import { notFound } from "next/navigation";
import { QuizRunner } from "@/components/QuizRunner";
import { NotFound } from "@/lib/learning";
import { quizBlockInfo } from "@/lib/quiz";

export const dynamic = "force-dynamic";

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let info;
  try {
    info = quizBlockInfo(id);
  } catch (e) {
    if (e instanceof NotFound) notFound();
    throw e;
  }
  return (
    <main className="narrow">
      <p className="crumbs">
        <Link href="/">← Learn</Link> · {info.chapter}
      </p>
      <h1>Quiz time</h1>
      <QuizRunner blockId={info.id} titles={info.titles} status={info.status} best={info.best} nextLesson={info.nextLesson} />
    </main>
  );
}
