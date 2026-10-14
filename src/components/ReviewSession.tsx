"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { post } from "@/lib/client";
import { AnswerBox } from "./AnswerBox";
import { Choices, CodeSnippet } from "./Choices";
import { InlineMd } from "./Markdown";
import { ReadAloud } from "./Speech";

type Item = {
  id: number;
  lessonId: string;
  lessonTitle: string;
  kind: "short" | "choice";
  question: string;
  code: string | null;
  options: string[] | null;
  stage: number;
};
type Result = { correct: boolean; feedback: string; done: boolean; nextDay: string | null };

/** Today's review: one question at a time. Missed ones come back tomorrow. */
export function ReviewSession() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [nextDay, setNextDay] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [right, setRight] = useState(0);

  useEffect(() => {
    fetch("/api/review")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items);
        setNextDay(d.counts.nextDay);
      });
  }, []);

  if (!items) return <p className="muted">Loading…</p>;

  if (items.length === 0 || i >= items.length) {
    const finished = items.length > 0;
    return (
      <section className="card celebrate">
        <h2>{finished ? "Review done! 🎉" : "Nothing to review today ✓"}</h2>
        <p className="big" style={{ margin: "0 auto" }}>
          {finished
            ? `You got ${right} of ${items.length} right. The ones you missed come back tomorrow, so they stick.`
            : nextDay
              ? `Your next review is on ${nextDay}. Questions you miss in lessons and quizzes come here.`
              : "When you miss a question in a lesson or quiz, it comes back here after 1, 3 and 7 days."}
        </p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link className="btn big-btn" href="/">
            Continue learning →
          </Link>
        </div>
      </section>
    );
  }

  const item = items[i];
  const answer = async (text: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await post<Result>(`/api/review/${item.id}`, { answer: text });
      setResult(r);
      if (r.correct) setRight((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };
  const next = () => {
    setI(i + 1);
    setPick(null);
    setResult(null);
  };
  const rightIndex = result && item.kind === "choice" ? (result.correct ? pick : null) : null;

  return (
    <section className="card step">
      <div className="flow-head">
        <span className="step-label">
          {i + 1} of {items.length}
        </span>
        <div className="bar" aria-hidden>
          <span style={{ width: `${(i / items.length) * 100}%` }} />
        </div>
      </div>
      <p className="muted small">From: {item.lessonTitle}</p>
      <p className="big question">
        <InlineMd>{item.question}</InlineMd>
      </p>
      <CodeSnippet code={item.code ?? ""} />
      <ReadAloud text={item.question} label="Read question" />

      {item.kind === "choice" && item.options ? (
        <>
          <Choices options={item.options} selected={pick} right={rightIndex} locked={!!result} onPick={setPick} />
          {!result && (
            <button className="btn" disabled={pick === null || busy} onClick={() => answer(String(pick))}>
              {busy ? "Checking…" : "Check"}
            </button>
          )}
        </>
      ) : (
        !result && <AnswerBox placeholder="Type or speak your answer…" busy={busy} onSubmit={answer} />
      )}

      {error && <p className="error">{error}</p>}
      {result && (
        <>
          <div className={result.correct ? "ok" : "error"}>
            <p>
              <b>{result.correct ? "✓ Right!" : "✗ Not quite."}</b> <InlineMd>{result.feedback}</InlineMd>
            </p>
            <p className="small">
              {result.done
                ? "You’ve now remembered this 3 times. It’s learned! 🎓"
                : result.correct
                  ? `It will come back on ${result.nextDay} to make it stick.`
                  : "It will come back tomorrow."}
            </p>
          </div>
          <button className="btn" onClick={next} autoFocus>
            {i + 1 < items.length ? "Next question →" : "Finish"}
          </button>
        </>
      )}
    </section>
  );
}
