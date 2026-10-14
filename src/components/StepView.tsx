"use client";

import { useEffect, useRef, useState } from "react";
import { post } from "@/lib/client";
import type { Reexplain, StepContent } from "@/lib/prompts";
import { AnswerBox } from "./AnswerBox";
import { CodeBox } from "./CodeBox";
import { InlineMd } from "./Markdown";
import { ReadAloud } from "./Speech";

export type StepInfo = { id: number; title: string; goal: string; passed: boolean };
type Verdict = { verdict: "correct" | "partly" | "wrong"; feedback: string };

/** Ask the tutor chat (next to the lesson) to explain something more. */
export function askTutor(text: string) {
  window.dispatchEvent(new CustomEvent("ct-ask", { detail: text }));
}

type Piece = { key: string; icon: string; title: string; speak: string; body: React.ReactNode };

/**
 * One step of a lesson, taught from zero: why → new words → how it works → picture it →
 * the code line by line → real life & mistakes → your turn. Pieces appear one at a time.
 */
export function StepView({
  step,
  stepLabel,
  nextStepId,
  onPassed,
}: {
  step: StepInfo;
  stepLabel: string;
  nextStepId: number | null;
  onPassed: () => void;
}) {
  const [content, setContent] = useState<StepContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(1);
  const [code, setCode] = useState("");
  const [again, setAgain] = useState<Reexplain | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Verdict | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [passed, setPassed] = useState(step.passed);
  const lastPiece = useRef<HTMLDivElement>(null);

  const load = async () => {
    setError(null);
    try {
      const c = await post<StepContent>(`/api/step/${step.id}`);
      setContent(c);
      setCode(c.example.lines.map((l) => l.code).join("\n"));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    setContent(null);
    setAgain(null);
    setResult(null);
    setWrong([]);
    setPassed(step.passed);
    setShown(step.passed ? 99 : 1);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  // Write the next step in the background while this one is being read.
  useEffect(() => {
    if (content && nextStepId) fetch(`/api/step/${nextStepId}`, { method: "POST" }).catch(() => {});
  }, [content, nextStepId]);

  const question = again?.question ?? content?.question ?? "";
  const answerKey = again?.answer_key ?? content?.answer_key ?? "";

  const answer = async (text: string) => {
    setBusy(true);
    try {
      const r = await post<Verdict>(`/api/step/${step.id}/check`, { question, answerKey, answer: text });
      setResult(r);
      if (r.verdict === "correct") {
        setPassed(true);
        onPassed();
      } else {
        const all = [...wrong, text];
        setWrong(all);
        if (all.length >= 2) {
          // Two misses: the tutor explains it another way, with a new question.
          const re = await post<Reexplain>(`/api/step/${step.id}/reexplain`, { wrongAnswers: all });
          setAgain(re);
          setWrong([]);
          setResult({ verdict: r.verdict, feedback: r.feedback + " Let’s look at it another way first. 👆" });
        }
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  const pieces: Piece[] = [];
  if (content) {
    const c = content;
    pieces.push({ key: "why", icon: "💡", title: "Why this matters", speak: c.why, body: <p className="big"><InlineMd>{c.why}</InlineMd></p> });
    if (c.new_words.length)
      pieces.push({
        key: "words",
        icon: "📖",
        title: "New words",
        speak: c.new_words.map((w) => `${w.word}. ${w.meaning}`).join(" "),
        body: (
          <div className="words">
            {c.new_words.map((w) => (
              <div key={w.word} className="word">
                <b>{w.word}</b> — <InlineMd>{w.meaning}</InlineMd>
              </div>
            ))}
          </div>
        ),
      });
    pieces.push({
      key: "how",
      icon: "⚙️",
      title: "How it works",
      speak: c.explanation.join(" "),
      body: c.explanation.map((p, i) => (
        <p key={i} className="big">
          <InlineMd>{p}</InlineMd>
        </p>
      )),
    });
    pieces.push({ key: "picture", icon: "🧠", title: "Picture it", speak: c.analogy, body: <p className="analogy"><InlineMd>{c.analogy}</InlineMd></p> });
    if (c.example.language !== "none" && c.example.lines.length)
      pieces.push({
        key: "code",
        icon: "🔍",
        title: "The code, line by line",
        speak: c.example.lines.filter((l) => l.explain).map((l) => l.explain).join(" "),
        body: (
          <>
            <div className="lines">
              {c.example.lines.map((l, i) => (
                <div key={i} className="line">
                  <span className="no">{i + 1}</span>
                  <div className="body">
                    <pre>{l.code || " "}</pre>
                    {l.explain && (
                      <p>
                        <InlineMd>{l.explain}</InlineMd>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <h3>💻 Now try it</h3>
            <p className="muted">
              Press Run{c.output ? <> and you should see: <code>{c.output.split("\n")[0]}</code>{c.output.includes("\n") ? " …" : ""}</> : ""}. Then change something and run it again. What changed, and why?
            </p>
            <CodeBox code={code} onChange={setCode} height={Math.min(260, 40 + c.example.lines.length * 24)} language={c.example.language} />
          </>
        ),
      });
    pieces.push({
      key: "real",
      icon: "🌍",
      title: "In real life",
      speak: `${c.real_world} Watch out: ${c.mistakes.join(" ")}`,
      body: (
        <>
          <p className="big">
            <InlineMd>{c.real_world}</InlineMd>
          </p>
          {c.mistakes.length > 0 && (
            <div className="warn">
              <b>Watch out</b>
              <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                {c.mistakes.map((m, i) => (
                  <li key={i}>
                    <InlineMd>{m}</InlineMd>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ),
    });
  }

  const visible = pieces.slice(0, Math.min(shown, pieces.length));
  const allShown = content !== null && shown >= pieces.length;
  const next = () => {
    setShown((s) => s + 1);
    setTimeout(() => lastPiece.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <section className="card step">
      <span className="step-label">{stepLabel}</span>
      <h2>{step.title}</h2>
      <p className="goal">{step.goal}</p>

      {error && (
        <p className="error">
          {error}{" "}
          <button className="btn secondary" onClick={load}>
            Try again
          </button>
        </p>
      )}
      {!content && !error && (
        <p className="info">✍️ Your tutor is writing this step for you from javascript.info and The Odin Project… (usually under a minute; the next step is written while you read this one)</p>
      )}

      {content && (
        <div className="mini-steps" aria-label={`Part ${Math.min(shown, pieces.length + 1)} of ${pieces.length + 1}`}>
          {[...pieces, null].map((_, i) => (
            <span key={i} className={i < Math.min(shown, pieces.length + 1) ? "on" : ""} />
          ))}
        </div>
      )}

      {visible.map((p, i) => (
        <div key={p.key} className="piece" ref={i === visible.length - 1 ? lastPiece : undefined}>
          <h3>
            <span aria-hidden>{p.icon}</span> {p.title}
          </h3>
          {p.body}
          <div className="piece-actions">
            <ReadAloud text={p.speak} label="Listen" />
            <button
              type="button"
              className="btn ghost"
              onClick={() => askTutor(`I don't fully understand this part of "${step.title}" (${p.title}): "${p.speak.slice(0, 600)}". Can you explain it more simply, from zero?`)}
            >
              🙋 Explain this more simply
            </button>
            {i === visible.length - 1 && !allShown && (
              <button type="button" className="btn" onClick={next} style={{ marginLeft: "auto" }}>
                Got it, next →
              </button>
            )}
          </div>
        </div>
      ))}

      {allShown && (
        <div className="piece" ref={shown === pieces.length ? lastPiece : undefined}>
          {again && (
            <div className="info" style={{ marginBottom: 14 }}>
              <h3 style={{ marginTop: 0 }}>🔁 Another way to see it</h3>
              {again.explanation.map((p, i) => (
                <p key={i}>
                  <InlineMd>{p}</InlineMd>
                </p>
              ))}
              <p className="analogy">
                🧠 <InlineMd>{again.analogy}</InlineMd>
              </p>
              <ReadAloud text={`${again.explanation.join(" ")} ${again.analogy}`} label="Listen" />
            </div>
          )}
          <h3>✋ Your turn</h3>
          <p className="big question">
            <InlineMd>{question}</InlineMd>
          </p>
          <ReadAloud text={question} label="Read question" />
          {passed && result?.verdict !== "correct" && (
            <p className="ok">✓ You already got this one. You can move on, or answer again for practice.</p>
          )}
          <AnswerBox placeholder="Type or speak your answer, in your own words…" busy={busy} onSubmit={answer} />
          {result && (
            <p className={result.verdict === "correct" ? "ok" : result.verdict === "partly" ? "warn" : "error"}>
              <b>{result.verdict === "correct" ? "✓ Right! " : result.verdict === "partly" ? "◐ Almost. " : "✗ Not yet. "}</b>
              <InlineMd>{result.feedback}</InlineMd>
              {result.verdict !== "correct" && <span className="small"> (This question will also come back in tomorrow’s review.)</span>}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
