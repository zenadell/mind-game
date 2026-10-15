"use client";

import { useEffect, useState } from "react";
import { post } from "@/lib/client";
import type { Reading } from "@/lib/train";
import { AnswerBox } from "./AnswerBox";
import { Choices, CodeSnippet } from "./Choices";
import { InlineMd } from "./Markdown";

type Res = { reading: Reading; stats: { answered: number; right: number } };

const KIND = {
  output: { icon: "🖨️", label: "Predict the output" },
  bug: { icon: "🐞", label: "Find the bug" },
  explain: { icon: "🧠", label: "What does it do?" },
} as const;

/** One code-reading challenge at a time, written from the lessons you've finished. */
export function ReadingRunner() {
  const [data, setData] = useState<Res | null>(null);
  const [busy, setBusy] = useState<string | null>("load");
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<number | null>(null);

  const load = async (fresh: boolean) => {
    setBusy("load");
    setError(null);
    setPick(null);
    try {
      setData(await post<Res>("/api/train/reading", { fresh }));
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  };
  useEffect(() => {
    load(false);
  }, []);

  const answer = async (body: { choice?: number; text?: string }) => {
    if (!data) return;
    setBusy("answer");
    try {
      setData(await post<Res>(`/api/train/reading/${data.reading.id}`, body));
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  };

  if (busy === "load")
    return <div className="card"><p className="muted">Your tutor is writing a challenge from the lessons you’ve finished…</p></div>;
  if (error && !data)
    return (
      <div className="card">
        <p className="error">{error}</p>
        <button className="btn" onClick={() => load(false)}>Try again</button>
      </div>
    );
  if (!data) return null;
  const r = data.reading;
  const done = !!r.verdict;
  const kind = KIND[r.kind];

  return (
    <div className="card reading">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="pill primary">
          {kind.icon} {kind.label}
        </span>
        <span className="muted small">
          {r.topic} · {data.stats.right} / {data.stats.answered} right
        </span>
      </div>
      <CodeSnippet code={numbered(r.code)} />
      <p className="question">
        <InlineMd>{r.question}</InlineMd>
      </p>
      {r.kind === "output" ? (
        <>
          <Choices options={r.options} selected={done ? r.options.indexOf(r.answer ?? "") : pick} right={r.correctIndex} locked={done} onPick={setPick} />
          {!done && (
            <button className="btn" disabled={pick === null || !!busy} onClick={() => answer({ choice: pick! })}>
              {busy === "answer" ? "Checking…" : "Lock in · +25 XP"}
            </button>
          )}
        </>
      ) : done ? (
        <div className="bubble learner">
          <div className="who">You</div>
          {r.answer}
        </div>
      ) : (
        <AnswerBox
          rows={4}
          placeholder={r.kind === "bug" ? "Line … is wrong because … Fix: …" : "It … A better name would be …"}
          busy={busy === "answer"}
          submitLabel="Submit · +25 XP"
          onSubmit={(text) => answer({ text })}
        />
      )}
      {error && <p className="error">{error}</p>}
      {done && (
        <>
          <div className={`bubble tutor ${r.verdict}`}>
            <div className="who">{r.verdict === "correct" ? "✔ Right" : r.verdict === "partly" ? "≈ Almost" : "✖ Not quite"}</div>
            <InlineMd>{r.feedback ?? ""}</InlineMd>
          </div>
          <div className="info">
            <b>How it works:</b> <InlineMd>{r.explain ?? ""}</InlineMd>
            {r.kind !== "output" && r.answerKey && (
              <p className="small" style={{ marginTop: 8 }}>
                <b>Model answer:</b> <InlineMd>{r.answerKey}</InlineMd>
              </p>
            )}
          </div>
        </>
      )}
      <div className="row" style={{ marginTop: 14 }}>
        {done ? (
          <button className="btn big-btn" onClick={() => load(false)}>
            Next challenge →
          </button>
        ) : (
          <button className="btn ghost" onClick={() => load(true)} disabled={!!busy}>
            Skip this one
          </button>
        )}
      </div>
    </div>
  );
}

/** Line numbers, so "which line is wrong?" is easy to answer. */
function numbered(code: string): string {
  const lines = code.split("\n");
  const w = String(lines.length).length;
  return lines.map((l, i) => `${String(i + 1).padStart(w)}  ${l}`).join("\n");
}
