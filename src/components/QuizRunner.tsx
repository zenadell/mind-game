"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { post } from "@/lib/client";
import { Choices, CodeSnippet } from "./Choices";
import { InlineMd } from "./Markdown";
import { MicButton, ReadAloud } from "./Speech";

type Q = { type: "choice" | "short"; question: string; code: string; options: string[] };
type Res = { correct: boolean; feedback: string; rightAnswer: string };
type Graded = { score: number; passed: boolean; passMark: number; results: Res[] };

type Props = {
  blockId: string;
  titles: string[];
  status: "locked" | "available" | "passed";
  best: number;
  nextLesson: { id: string; title: string } | null;
};

/** Intro → one question at a time → results. */
const BOSSES = ["👾", "🐉", "🤖", "👹", "🦖", "🧌", "🦑", "🐙"];

/** Every quiz is a boss: each right answer hits it. Bring its health to 30% or below to win. */
function bossFor(blockId: string, lastTitle: string) {
  const h = [...blockId].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return { emoji: BOSSES[h % BOSSES.length], name: `Guardian of the lessons up to “${lastTitle}”` };
}

function BossCard({ emoji, name, hp, hit, defeated }: { emoji: string; name: string; hp: number; hit?: boolean; defeated?: boolean }) {
  return (
    <div className={`boss ${hit ? "hit" : ""} ${defeated ? "defeated" : ""}`}>
      <div className="boss-emoji" aria-hidden>
        {defeated ? "💥" : emoji}
      </div>
      <div className="boss-info">
        <div className="boss-name">{name}</div>
        <div className="boss-hp" aria-label={`Boss health ${Math.round(hp)}%`}>
          <span style={{ width: `${hp}%` }} />
          <i style={{ left: "30%" }} title="Bring it below this line to win" />
        </div>
        <div className="small muted">{Math.round(hp)}% health</div>
      </div>
    </div>
  );
}

export function QuizRunner(p: Props) {
  const boss = bossFor(p.blockId, p.titles[p.titles.length - 1] ?? "the Lessons");
  const [hp, setHp] = useState(100);
  const [hit, setHit] = useState(false);
  const [quiz, setQuiz] = useState<{ quizId: number; questions: Q[] } | null>(null);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [graded, setGraded] = useState<Graded | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // After marking: the boss takes one hit per right answer.
  useEffect(() => {
    if (!graded) return;
    setHp(100);
    const hits = graded.results.filter((r) => r.correct).length;
    const per = 100 / graded.results.length;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let k = 1; k <= hits; k++) {
      timers.push(
        setTimeout(() => {
          setHp(Math.max(0, 100 - per * k));
          setHit(true);
          window.dispatchEvent(new CustomEvent("ct-sound", { detail: "xp" }));
          setTimeout(() => setHit(false), 250);
        }, 500 + k * 450),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [graded]);

  const start = async () => {
    setBusy("start");
    setError(null);
    try {
      const r = await post<{ locked: boolean; quizId?: number; questions?: Q[] }>(`/api/quiz/${p.blockId}`);
      if (r.locked || !r.quizId || !r.questions) throw new Error("Finish the lessons before this quiz first.");
      setQuiz({ quizId: r.quizId, questions: r.questions });
      setAnswers(r.questions.map(() => ""));
      setI(0);
      setGraded(null);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  };

  const submit = async () => {
    if (!quiz) return;
    setBusy("submit");
    setError(null);
    try {
      setGraded(await post<Graded>(`/api/quiz/${p.blockId}/submit`, { quizId: quiz.quizId, answers }));
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  };

  if (p.status === "locked") {
    return (
      <section className="card">
        <p className="big">🔒 This quiz opens when you finish these lessons:</p>
        <ul>{p.titles.map((t) => <li key={t}>{t}</li>)}</ul>
        <Link className="btn" href="/">Back to lessons</Link>
      </section>
    );
  }

  // ----- Results -----
  if (quiz && graded) {
    const pct = Math.round(graded.score * 100);
    const finalHp = Math.max(0, 100 - pct);
    return (
      <>
        <section className={`card ${graded.passed ? "celebrate" : ""}`} style={{ textAlign: "center" }}>
          <BossCard emoji={boss.emoji} name={boss.name} hp={hp} hit={hit} defeated={graded.passed && hp <= finalHp} />
          <div className="score">{pct}%</div>
          <h2 style={{ marginTop: 10 }}>
            {graded.passed
              ? "Boss defeated! ⚔️🎉"
              : graded.score >= 0.5
                ? `So close! The boss survived with ${finalHp}% health.`
                : `The boss survived with ${finalHp}% health. Let’s train and come back.`}
          </h2>
          <p className="big" style={{ margin: "0 auto" }}>
            {graded.passed
              ? "The next lessons are unlocked. Questions you missed are in your review for tomorrow."
              : `You need ${Math.round(graded.passMark * 100)}% to pass. Read the explanations below, then try a new quiz.`}
          </p>
          <div className="row" style={{ justifyContent: "center" }}>
            {graded.passed && p.nextLesson ? (
              <Link className="btn big-btn" href={`/lesson/${p.nextLesson.id}`}>
                Next: {p.nextLesson.title} →
              </Link>
            ) : graded.passed ? (
              <Link className="btn big-btn" href="/">Back to lessons</Link>
            ) : (
              <button className="btn big-btn" onClick={start} disabled={!!busy}>
                {busy === "start" ? "Writing a new quiz…" : "Try a new quiz"}
              </button>
            )}
          </div>
        </section>
        <section className="card">
          <h2>Your answers</h2>
          <ol className="result-list">
            {quiz.questions.map((q, k) => {
              const r = graded.results[k];
              const mine = q.type === "choice" ? q.options[Number(answers[k])] ?? "(no answer)" : answers[k] || "(no answer)";
              return (
                <li key={k}>
                  <p>
                    <span className={`pill ${r.correct ? "ok" : "warn"}`}>{r.correct ? "✓ right" : "✗ missed"}</span> <b>
                      <InlineMd>{q.question}</InlineMd>
                    </b>
                  </p>
                  <CodeSnippet code={q.code} />
                  {q.type === "choice" ? (
                    <p className="small">
                      Your answer: <code>{mine}</code>
                      {!r.correct && (
                        <>
                          {" "}
                          · Right answer: <code>{r.rightAnswer}</code>
                        </>
                      )}
                    </p>
                  ) : (
                    <p className="small">
                      Your answer: “{mine}”
                      {!r.correct && <> · A good answer: “{r.rightAnswer}”</>}
                    </p>
                  )}
                  <p className="muted">
                    <InlineMd>{r.feedback}</InlineMd>
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      </>
    );
  }

  // ----- Intro -----
  if (!quiz) {
    return (
      <section className="card">
        <BossCard emoji={boss.emoji} name={boss.name} hp={100} />
        <p className="big">A boss guards the next lessons. Beat it with what you learned in:</p>
        <ul className="big">{p.titles.map((t) => <li key={t}>{t}</li>)}</ul>
        <div className="info">
          <p>
            <b>6 questions</b> · each right answer is a hit · bring the boss to <b>30% health</b> or less to win · no hints, no tutor. Missed questions go into your daily review.
          </p>
          {p.status === "passed" && <p>You already passed this one (best {Math.round(p.best * 100)}%). Practising again is fine!</p>}
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn big-btn" onClick={start} disabled={!!busy}>
          {busy === "start" ? "The boss is getting ready… (about 20 seconds)" : "⚔️ Start the fight"}
        </button>
      </section>
    );
  }

  // ----- One question at a time -----
  const q = quiz.questions[i];
  const last = i === quiz.questions.length - 1;
  const setAnswer = (v: string) => setAnswers((a) => a.map((x, k) => (k === i ? v : x)));
  const answered = answers[i].trim() !== "";
  return (
    <section className="card step">
      <BossCard emoji={boss.emoji} name={boss.name} hp={100} />
      <div className="flow-head">
        <span className="step-label">
          Question {i + 1} of {quiz.questions.length}
        </span>
        <div className="bar" aria-hidden>
          <span style={{ width: `${(i / quiz.questions.length) * 100}%` }} />
        </div>
      </div>
      <p className="big question">
        <InlineMd>{q.question}</InlineMd>
      </p>
      <CodeSnippet code={q.code} />
      <ReadAloud text={q.question} label="Read question" />
      {q.type === "choice" ? (
        <Choices options={q.options} selected={answers[i] === "" ? null : Number(answers[i])} onPick={(k) => setAnswer(String(k))} />
      ) : (
        <div className="answer">
          <textarea rows={3} value={answers[i]} onChange={(e) => setAnswer(e.target.value)} placeholder="Type or speak your answer…" />
          <div className="row">
            <MicButton onText={(t) => setAnswer((answers[i] ? answers[i] + " " : "") + t)} />
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <div className="row">
        {i > 0 && (
          <button className="btn secondary" onClick={() => setI(i - 1)}>
            ← Back
          </button>
        )}
        {last ? (
          <button className="btn" onClick={submit} disabled={!answered || !!busy}>
            {busy === "submit" ? "Striking…" : "⚔️ Final strike: see the damage"}
          </button>
        ) : (
          <button className="btn" onClick={() => setI(i + 1)} disabled={!answered}>
            Next →
          </button>
        )}
      </div>
    </section>
  );
}
