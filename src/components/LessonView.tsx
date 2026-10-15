"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { post } from "@/lib/client";
import { AnswerBox } from "./AnswerBox";
import { ExerciseCard, type ExState, type Exercise } from "./ExerciseCard";
import { InlineMd } from "./Markdown";
import { ReadAloud } from "./Speech";
import { SectionView, type SectionInfo } from "./SectionView";
import { TutorChat } from "./TutorChat";

type Props = {
  lesson: { id: string; title: string; chapter: string; sourceUrl: string };
  steps: SectionInfo[];
  goals: string[];
  reading: { text: string; url: string }[];
  odin: { title: string; url: string }[];
  exercises: Exercise[];
  teachbackPassed: boolean;
  completed: boolean;
  chunkIndex: number;
  next: { id: string; title: string } | null;
  quizAfter: { id: string; status: "locked" | "available" | "passed" } | null;
  chat: { role: "user" | "assistant"; content: string }[];
};

type TeachbackResult = { verdict: "understood" | "partly" | "not_yet"; feedback: string; missing: string[] };

export function LessonView(p: Props) {
  const steps = p.steps;
  const [passed, setPassed] = useState(() => p.steps.map((c) => c.passed));
  const [teachback, setTeachback] = useState(p.teachbackPassed);
  const [exStates, setExStates] = useState<Record<string, ExState>>(() =>
    Object.fromEntries(p.exercises.map((e) => [e.id, e.state])),
  );
  const [completed, setCompleted] = useState(p.completed);
  const [tbResult, setTbResult] = useState<TeachbackResult | null>(null);
  const [tbBusy, setTbBusy] = useState(false);

  const n = steps.length;
  const TEACH = n;
  const PRACTICE = n + 1;
  const firstOpen = passed.findIndex((x) => !x);
  const maxStep = firstOpen === -1 ? PRACTICE : firstOpen;
  const [step, setStep] = useState(Math.min(p.chunkIndex, maxStep));

  const go = (i: number) => {
    const s = Math.max(0, Math.min(i, maxStep));
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
    post(`/api/lesson/${p.lesson.id}/position`, { chunkIndex: s }).catch(() => {});
  };

  const tryComplete = useCallback(async () => {
    const r = await post<{ completed: boolean }>(`/api/lesson/${p.lesson.id}/complete`).catch(() => null);
    if (r?.completed) setCompleted(true);
  }, [p.lesson.id]);

  useEffect(() => {
    const allEx = Object.values(exStates).every((s) => s.done);
    if (!completed && n > 0 && teachback && allEx && passed.every(Boolean)) tryComplete();
  }, [exStates, teachback, passed, completed, tryComplete, n]);

  const sendTeachback = async (text: string) => {
    setTbBusy(true);
    try {
      const r = await post<TeachbackResult>(`/api/lesson/${p.lesson.id}/teachback`, { text });
      setTbResult(r);
      if (r.verdict === "understood") setTeachback(true);
    } catch (err) {
      setTbResult({ verdict: "not_yet", feedback: (err as Error).message, missing: [] });
    }
    setTbBusy(false);
  };

  const doneEx = Object.values(exStates).filter((s) => s.done).length;

  return (
    <div className="lesson">
      <div className="lesson-main">
        <p className="crumbs">
          <Link href="/">← All lessons</Link> · {p.lesson.chapter}
        </p>
        <h1 className="lesson-head">{p.lesson.title}</h1>
        <p className="attribution">
          Built from <a href={p.lesson.sourceUrl} target="_blank" rel="noreferrer">javascript.info</a>
          {p.odin.length > 0 && (
            <>
              {" "}+{" "}
              <a href={p.odin[0].url} target="_blank" rel="noreferrer">
                The Odin Project
              </a>
            </>
          )}
          .
        </p>

        <div className="bar thin" aria-label={`${passed.filter(Boolean).length} of ${n} steps done`}>
          <span style={{ width: `${((passed.filter(Boolean).length + (teachback ? 1 : 0) + doneEx) / (n + 1 + p.exercises.length)) * 100}%` }} />
        </div>
        {n > 0 && <nav className="steps" aria-label="Lesson steps">
          {steps.map((c, i) => (
            <button
              key={c.id}
              className={`dot ${i === step ? "current" : ""} ${passed[i] ? "passed" : ""}`}
              disabled={i > maxStep}
              onClick={() => go(i)}
              title={c.title}
            >
              {passed[i] ? "✔" : i + 1}
            </button>
          ))}
          <button className={`dot wide ${step === TEACH ? "current" : ""} ${teachback ? "passed" : ""}`} disabled={TEACH > maxStep} onClick={() => go(TEACH)}>
            🗣 Teach-back
          </button>
          <button
            className={`dot wide ${step === PRACTICE ? "current" : ""} ${doneEx === p.exercises.length ? "passed" : ""}`}
            disabled={PRACTICE > maxStep}
            onClick={() => go(PRACTICE)}
          >
            💻 Practice {p.exercises.length ? `${doneEx}/${p.exercises.length}` : ""}
          </button>
        </nav>}

        {completed && (
          <div className="card celebrate">
            <h2>🎉 Lesson complete!</h2>
            <p className="big" style={{ margin: "0 auto" }}>
              You explained it, checked it, and practised it. That’s real learning.
            </p>
            <div className="row" style={{ justifyContent: "center" }}>
              {p.quizAfter && p.quizAfter.status !== "passed" ? (
                <Link className="btn big-btn" href={`/quiz/${p.quizAfter.id}`}>
                  Quiz time: test the last few lessons →
                </Link>
              ) : p.next ? (
                <Link className="btn big-btn" href={`/lesson/${p.next.id}`}>
                  Next: {p.next.title} →
                </Link>
              ) : (
                <Link className="btn big-btn" href="/">
                  Back to lessons
                </Link>
              )}
            </div>
          </div>
        )}

        {step === 0 && p.goals.length > 0 && !completed && (
          <details className="card soft tight mission">
            <summary>
              🎯 <b>Your mission:</b> {p.goals.length} things you’ll be able to do after this lesson
            </summary>
            <ul className="recap">
              {p.goals.map((g) => (
                <li key={g}>
                  <InlineMd>{g}</InlineMd>
                </li>
              ))}
            </ul>
          </details>
        )}

        {step < n && (
          <>
            <SectionView
              step={steps[step]}
              stepLabel={`Part ${step + 1} of ${n}`}
              nextStepId={steps[step + 1]?.id ?? null}
              onPassed={() => setPassed((old) => old.map((x, i) => (i === step ? true : x)))}
            />
            <div className="row">
              {step > 0 && (
                <button className="btn secondary" onClick={() => go(step - 1)}>
                  ← Back
                </button>
              )}
              <button className="btn" disabled={!passed[step]} onClick={() => go(step + 1)}>
                {passed[step] ? "Next →" : "Answer the check to continue"}
              </button>
            </div>
          </>
        )}

        {n > 0 && step === TEACH && (
          <section className="card step">
            <h2>🗣 Teach it back</h2>
            <p className="big">
              Imagine a friend missed this lesson. Explain <b>{p.lesson.title}</b> to them in your own words. Short and simple is fine.
            </p>
            <ReadAloud text={`Imagine a friend missed this lesson. Explain ${p.lesson.title} to them in your own words.`} />
            <p className="muted">Tip: press 🎤 Speak and just talk, like you would to a friend.</p>
            <AnswerBox rows={6} placeholder="So basically…" busy={tbBusy} onSubmit={sendTeachback} />
            {tbResult && (
              <div className={tbResult.verdict === "understood" ? "ok" : tbResult.verdict === "partly" ? "warn" : "error"}>
                <p>
                  {tbResult.verdict === "understood" ? "✔ You understood it! " : tbResult.verdict === "partly" ? "◐ Partly there. " : "✖ Not yet. "}
                  <InlineMd>{tbResult.feedback}</InlineMd>
                </p>
                {tbResult.missing.length > 0 && (
                  <ul>
                    {tbResult.missing.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {teachback && (
              <button className="btn" onClick={() => go(PRACTICE)}>
                {p.exercises.length ? "Go to practice →" : "Finish lesson →"}
              </button>
            )}
          </section>
        )}

        {n > 0 && step === PRACTICE && (
          <>
            {p.exercises.length === 0 && (
              <section className="card">
                <p className="big">This lesson has no coding exercises. {teachback ? "You're done here!" : "Finish the teach-back to complete it."}</p>
              </section>
            )}
            {!teachback && p.exercises.length > 0 && (
              <p className="warn">You can practise now, but the lesson only completes after you pass the teach-back too.</p>
            )}
            {p.exercises.map((e) => (
              <ExerciseCard key={e.id} ex={e} onChange={(s) => setExStates((old) => ({ ...old, [e.id]: s }))} />
            ))}
          </>
        )}
        {p.reading.length > 0 && (
          <details className="card soft tight">
            <summary>
              <b>Want to go deeper?</b> The Odin Project’s reading list for this topic
            </summary>
            <ul>
              {p.reading.map((r) => (
                <li key={r.url}>
                  <a href={r.url} target="_blank" rel="noreferrer">
                    {r.text}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="sources">
          Sources: <a href={p.lesson.sourceUrl} target="_blank" rel="noreferrer">javascript.info: {p.lesson.title}</a>
          {p.odin.map((o) => (
            <a key={o.url} href={o.url} target="_blank" rel="noreferrer">
              The Odin Project: {o.title}
            </a>
          ))}
          <br />
          javascript.info by Ilya Kantor (CC BY-NC) · The Odin Project (CC BY-NC-SA). Shown as the authors wrote them; the notes around them are from your AI tutor.
        </p>
      </div>
      <TutorChat lessonId={p.lesson.id} initial={p.chat} />
    </div>
  );
}
