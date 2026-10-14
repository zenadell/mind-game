"use client";

import { useEffect, useState } from "react";
import { post } from "@/lib/client";
import { outputText, runCode, type RunResult } from "@/lib/sandbox";
import { AnswerBox } from "./AnswerBox";
import { CodeBox, Output, splitInputs } from "./CodeBox";
import { InlineMd, Markdown } from "./Markdown";
import { ReadAloud } from "./Speech";

export type ExState = {
  hintsUsed: number;
  failedAttempts: number;
  passed: boolean;
  solutionShown: boolean;
  retypePassed: boolean;
  explainPassed: boolean;
  done: boolean;
  canHint: boolean;
  canSeeSolution: boolean;
};

export type Exercise = {
  id: string;
  title: string;
  promptMd: string;
  starterCode: string;
  tests: string | null;
  importance: number;
  sourceUrl: string;
  state: ExState;
};

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

/** One practice exercise with Run, Check, the hint ladder and the solution rule. */
export function ExerciseCard({ ex, onChange }: { ex: Exercise; onChange: (s: ExState) => void }) {
  const [code, setCode] = useState(ex.starterCode);
  const [state, setState] = useState(ex.state);
  const [hints, setHints] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error" | "warn"; text: string } | null>(null);
  const [check, setCheck] = useState<RunResult | null>(null);
  const [solution, setSolution] = useState<string | null>(null);
  const [retyping, setRetyping] = useState(false);
  const [inputs, setInputs] = useState("");

  useEffect(() => {
    setCode(store.get(`ct-code-${ex.id}`) ?? ex.starterCode);
    setHints(JSON.parse(store.get(`ct-hints-${ex.id}`) ?? "[]"));
    setRetyping(store.get(`ct-retype-${ex.id}`) === "1");
  }, [ex.id, ex.starterCode]);

  const update = (s: ExState) => {
    setState(s);
    onChange(s);
  };
  const edit = (c: string) => {
    setCode(c);
    store.set(`ct-code-${ex.id}`, c);
  };

  const doCheck = async () => {
    setBusy("check");
    setMessage(null);
    try {
      const run = await runCode(code, { tests: ex.tests, inputs: splitInputs(inputs) });
      setCheck(run);
      const failures = run.results?.filter((t) => !t.passed) ?? [];
      const testsPassed = !!ex.tests && !run.error && !!run.results?.length && failures.length === 0;
      const r = await post<{ passed: boolean; feedback: string; state: ExState }>(`/api/exercise/${ex.id}/attempt`, {
        code,
        testsPassed,
        testReport: run.error ?? failures.map((f) => `${f.name}: ${f.error}`).join("\n"),
        output: outputText(run),
      });
      update(r.state);
      setMessage({ kind: r.passed ? "ok" : "error", text: (r.passed ? "✔ " : "✖ ") + r.feedback });
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    }
    setBusy(null);
  };

  const getHint = async () => {
    setBusy("hint");
    try {
      const r = await post<{ hint: string | null; reason?: string; state: ExState }>(`/api/exercise/${ex.id}/hint`, { code });
      update(r.state);
      if (r.hint) {
        const all = [...hints, r.hint];
        setHints(all);
        store.set(`ct-hints-${ex.id}`, JSON.stringify(all));
      } else setMessage({ kind: "warn", text: r.reason ?? "No hint right now." });
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    }
    setBusy(null);
  };

  const showSolution = async () => {
    if (!confirm("After you see the solution, you must retype it from memory and explain every line before this exercise counts. Continue?")) return;
    const r = await post<{ solution: string | null; reason?: string; state: ExState }>(`/api/exercise/${ex.id}/solution`);
    update(r.state);
    if (r.solution) setSolution(r.solution);
    else setMessage({ kind: "warn", text: r.reason ?? "" });
  };

  const startRetype = () => {
    setSolution(null);
    setRetyping(true);
    store.set(`ct-retype-${ex.id}`, "1");
    edit(ex.starterCode);
    setMessage({ kind: "warn", text: "Now type the solution from memory. Pasting is turned off." });
  };

  const explainLines = async (text: string) => {
    setBusy("explain");
    try {
      const r = await post<{ passed: boolean; feedback: string; state: ExState }>(`/api/exercise/${ex.id}/explain-lines`, {
        code,
        explanation: text,
      });
      update(r.state);
      setMessage({ kind: r.passed ? "ok" : "error", text: (r.passed ? "✔ " : "✖ ") + r.feedback });
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    }
    setBusy(null);
  };

  const needsRetype = state.solutionShown && !state.retypePassed;
  const needsExplain = state.solutionShown && state.retypePassed && !state.explainPassed;

  return (
    <section className={`card exercise ${state.done ? "done" : ""}`}>
      <h3>
        {state.done ? "✔ " : ""}
        {ex.title}
      </h3>
      <Markdown>{ex.promptMd}</Markdown>
      <ReadAloud text={ex.promptMd} label="Read task" />
      <p className="attribution">
        Task from <a href={ex.sourceUrl} target="_blank" rel="noreferrer">javascript.info</a>
        {ex.tests ? " · checked by automatic tests" : " · checked by your tutor"}
      </p>

      {solution && (
        <div className="solution">
          <h4>Solution — study it, then hide it</h4>
          <Markdown>{solution}</Markdown>
          <button className="btn" onClick={startRetype}>
            I’ve studied it. Hide it and let me retype it
          </button>
        </div>
      )}

      {!solution && (
        <CodeBox
          code={code}
          onChange={edit}
          height={260}
          blockPaste={retyping && needsRetype}
          inputs={inputs}
          onInputsChange={setInputs}
        >
          <button type="button" className="btn" onClick={doCheck} disabled={!!busy}>
            {busy === "check" ? "Checking…" : "✓ Check"}
          </button>
          {!state.solutionShown && (
            <button type="button" className="btn secondary" onClick={getHint} disabled={!!busy || !state.canHint}>
              {busy === "hint" ? "Thinking…" : `💡 Hint ${Math.min(state.hintsUsed + 1, 3)}/3`}
            </button>
          )}
          {state.canSeeSolution && (
            <button type="button" className="btn secondary" onClick={showSolution}>
              Show solution
            </button>
          )}
        </CodeBox>
      )}

      {check?.results && <Output result={{ ...check, logs: [] }} />}
      {message && <p className={message.kind}>
          <InlineMd>{message.text}</InlineMd>
        </p>}

      {hints.length > 0 && (
        <ol className="hints">
          {hints.map((h, i) => (
            <li key={i}>
              <Markdown>{h}</Markdown>
            </li>
          ))}
        </ol>
      )}
      {!state.passed && !state.solutionShown && !state.canHint && state.hintsUsed < 3 && (
        <p className="muted">Next hint unlocks after you try again with Check.</p>
      )}
      {!state.passed && !state.solutionShown && state.hintsUsed >= 3 && !state.canSeeSolution && (
        <p className="muted">
          The solution unlocks after {Math.max(0, 3 - state.failedAttempts)} more tr{3 - state.failedAttempts === 1 ? "y" : "ies"}. You can do it!
        </p>
      )}
      {needsRetype && !solution && <p className="warn">Retype the solution from memory, then press Check.</p>}
      {needsExplain && (
        <div>
          <p className="warn">Last step: explain what each line of your code does, in your own words.</p>
          <AnswerBox rows={5} placeholder="Line 1 … Line 2 …" busy={busy === "explain"} submitLabel="Submit explanation" onSubmit={explainLines} />
        </div>
      )}
    </section>
  );
}
