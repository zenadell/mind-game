"use client";

import { useEffect, useState } from "react";
import { post } from "@/lib/client";
import type { Explain } from "@/lib/prompts";
import { AnswerBox } from "./AnswerBox";
import { CodeBox } from "./CodeBox";
import { Markdown } from "./Markdown";
import { ReadAloud } from "./Speech";

type Chunk = { id: number; heading: string; bodyMd: string; passed: boolean };
type Verdict = { verdict: "correct" | "partly" | "wrong"; feedback: string };

/** One small idea: short explanation, a runnable example, then a check question. */
export function ChunkStep({ chunk, sourceUrl, onPassed }: { chunk: Chunk; sourceUrl: string; onPassed: () => void }) {
  const [explain, setExplain] = useState<Explain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [example, setExample] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Verdict | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [showOriginal, setShowOriginal] = useState(false);
  const [passed, setPassed] = useState(chunk.passed);

  const load = async (again?: { previous: Explain; wrongAnswers: string[] }) => {
    setError(null);
    try {
      const e = await post<Explain>(`/api/chunk/${chunk.id}/explain`, { again });
      setExplain(e);
      setExample(e.example);
      setResult(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    setExplain(null);
    setResult(null);
    setWrong([]);
    setPassed(chunk.passed);
    setShowOriginal(false);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunk.id]);

  const answer = async (text: string) => {
    if (!explain) return;
    setBusy(true);
    try {
      const r = await post<Verdict>(`/api/chunk/${chunk.id}/check`, {
        question: explain.question,
        answerKey: explain.answer_key,
        answer: text,
      });
      setResult(r);
      if (r.verdict === "correct") {
        setPassed(true);
        onPassed();
      } else {
        const all = [...wrong, text];
        setWrong(all);
        // Two misses: explain it a different way.
        if (all.length >= 2) {
          setExplain(null);
          await load({ previous: explain, wrongAnswers: all });
          setWrong([]);
          setResult({ verdict: r.verdict, feedback: r.feedback + " Let's try it another way. 👇" });
        }
      }
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

  return (
    <section className="card step">
      <h2>{chunk.heading}</h2>
      {error && (
        <p className="error">
          {error} <button className="btn secondary" onClick={() => load()}>Try again</button>
        </p>
      )}
      {!explain && !error && <p className="muted">Your tutor is preparing this step…</p>}
      {explain && (
        <>
          <p className="big">{explain.explanation}</p>
          <p className="analogy">🧠 {explain.analogy}</p>
          <ReadAloud text={`${explain.explanation} ${explain.analogy}`} />

          <h3>Try it</h3>
          <p className="muted">Run it. Then change something and run it again. What changed?</p>
          <CodeBox code={example} onChange={setExample} height={170} />

          <h3>Check</h3>
          <p className="big question">❓ {explain.question}</p>
          <ReadAloud text={explain.question} label="Read question" />
          {passed && result?.verdict !== "correct" && <p className="ok">✔ You already got this one. You can move on, or answer again for practice.</p>}
          <AnswerBox placeholder="Type or speak your answer…" busy={busy} onSubmit={answer} />
          {result && (
            <p className={result.verdict === "correct" ? "ok" : result.verdict === "partly" ? "warn" : "error"}>
              {result.verdict === "correct" ? "✔ " : result.verdict === "partly" ? "◐ Almost. " : "✖ Not yet. "}
              {result.feedback}
            </p>
          )}
        </>
      )}
      <p>
        <button type="button" className="link" onClick={() => setShowOriginal((s) => !s)}>
          {showOriginal ? "Hide" : "Show"} the original text from javascript.info
        </button>
      </p>
      {showOriginal && (
        <div className="original">
          <Markdown>{chunk.bodyMd}</Markdown>
          <p className="attribution">
            Source: <a href={sourceUrl} target="_blank" rel="noreferrer">{sourceUrl}</a> by Ilya Kantor, CC BY-NC.
          </p>
        </div>
      )}
    </section>
  );
}
