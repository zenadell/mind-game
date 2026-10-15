"use client";

import { useEffect, useRef, useState } from "react";
import { post } from "@/lib/client";
import type { SectionHelp, StepContent } from "@/lib/prompts";
import { CheckChat } from "./CheckChat";
import { DeepLesson, Words } from "./DeepLesson";
import { InlineMd } from "./Markdown";
import { OriginalText } from "./OriginalText";
import { ReadAloud } from "./Speech";

export type SectionInfo = { id: number; title: string; sourceName: string; sourceUrl: string; bodyMd: string; passed: boolean };

/**
 * One section of a lesson: the ORIGINAL text (javascript.info or The Odin Project), with the
 * tutor around it: before you read → read (with tools) → in plain words → your turn.
 */
export function SectionView({
  step,
  stepLabel,
  nextStepId,
  onPassed,
}: {
  step: SectionInfo;
  stepLabel: string;
  nextStepId: number | null;
  onPassed: () => void;
}) {
  const [help, setHelp] = useState<SectionHelp | null>(null);
  const [helpError, setHelpError] = useState<string | null>(null);
  const [read, setRead] = useState(step.passed);
  const [deep, setDeep] = useState<StepContent | null>(null);
  const [deepState, setDeepState] = useState<"closed" | "loading" | "open" | string>("closed");
  const [passed, setPassed] = useState(step.passed);
  const after = useRef<HTMLDivElement>(null);

  const loadHelp = async () => {
    setHelpError(null);
    try {
      setHelp(await post<SectionHelp>(`/api/step/${step.id}`));
    } catch (e) {
      setHelpError((e as Error).message);
    }
  };

  useEffect(() => {
    setHelp(null);
    setDeep(null);
    setDeepState("closed");
    setRead(step.passed);
    setPassed(step.passed);
    loadHelp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  // Prepare the next section's help in the background while this one is read.
  useEffect(() => {
    if (help && nextStepId) fetch(`/api/step/${nextStepId}`, { method: "POST" }).catch(() => {});
  }, [help, nextStepId]);

  const openDeep = async () => {
    if (deepState === "open") return setDeepState("closed");
    if (deep) return setDeepState("open");
    setDeepState("loading");
    try {
      setDeep(await post<StepContent>(`/api/step/${step.id}/deep`));
      setDeepState("open");
    } catch (e) {
      setDeepState((e as Error).message);
    }
  };

  const doneReading = () => {
    setRead(true);
    setTimeout(() => after.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <section className="card step">
      <div className="step-head">
        <span className="step-label">{stepLabel}</span>
        <a className={`source-badge ${step.sourceName === "javascript.info" ? "jsinfo" : "odin"}`} href={step.sourceUrl} target="_blank" rel="noreferrer">
          {step.sourceName}
        </a>
      </div>
      <h2>{step.title}</h2>

      <div className="before">
        <h3>👀 Before you read</h3>
        {help ? (
          <>
            <p className="big">
              <InlineMd>{help.about}</InlineMd>
            </p>
            {help.words.length > 0 && (
              <details className="words-box" open>
                <summary>📖 Words you’ll meet ({help.words.length})</summary>
                <Words words={help.words} />
              </details>
            )}
          </>
        ) : helpError ? (
          <p className="error">
            {helpError}{" "}
            <button className="btn secondary" onClick={loadHelp}>
              Try again
            </button>
          </p>
        ) : (
          <p className="muted">Your tutor is reading this section to prepare your notes… You can start reading below.</p>
        )}
      </div>

      <div className="piece">
        <div className="read-head">
          <h3>📄 Read: the original lesson</h3>
          <ReadAloud text={`${step.title}. ${step.bodyMd}`} label="Listen" />
        </div>
        <p className="small muted">
          Tip: select any sentence you don’t understand and press 🙋 <b>Explain this</b>. Each code example has ▶ Try it and 🔍 Explain line by line.
        </p>
        <OriginalText md={step.bodyMd} stepId={step.id} title={step.title} />
        <div className="piece-actions">
          <button type="button" className="btn ghost" onClick={openDeep} disabled={deepState === "loading"}>
            {deepState === "loading"
              ? "🧑‍🏫 Writing a from-zero lesson… (up to a minute)"
              : deepState === "open"
                ? "Hide the from-zero lesson"
                : "🧑‍🏫 Still lost? Teach me this from zero"}
          </button>
          {!read && (
            <button type="button" className="btn" style={{ marginLeft: "auto" }} onClick={doneReading}>
              I’ve read it →
            </button>
          )}
        </div>
        {!["closed", "loading", "open"].includes(deepState) && <p className="error">{deepState}</p>}
        {deepState === "open" && deep && (
          <div className="deep-panel">
            <p className="small muted">Your tutor’s from-zero version of this section:</p>
            <DeepLesson title={step.title} content={deep} />
          </div>
        )}
      </div>

      {read && (
        <div className="piece" ref={after}>
          {help ? (
            <>
              {help.recap.length > 0 && (
                <>
                  <div className="read-head">
                    <h3>✍️ In plain words</h3>
                    <ReadAloud text={help.recap.join(" ")} label="Listen" />
                  </div>
                  <ul className="recap">
                    {help.recap.map((r, i) => (
                      <li key={i}>
                        <InlineMd>{r}</InlineMd>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <CheckChat
                stepId={step.id}
                question={help.question}
                answerKey={help.answer_key}
                passed={passed}
                onPassed={() => {
                  setPassed(true);
                  onPassed();
                }}
              />
            </>
          ) : (
            <p className="muted">Your tutor is still preparing the recap and question…</p>
          )}
        </div>
      )}
    </section>
  );
}
