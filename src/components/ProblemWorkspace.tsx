"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { post } from "@/lib/client";
import { runCode, type RunResult } from "@/lib/sandbox";
import type { StepContent, Editorial } from "@/lib/prompts";
import type { ProblemState, problemView } from "@/lib/train";
import { AnswerBox } from "./AnswerBox";
import { CodeBox, Output } from "./CodeBox";
import { DeepLesson, Lines } from "./DeepLesson";
import { InlineMd, Markdown } from "./Markdown";
import { ReadAloud } from "./Speech";

type View = ReturnType<typeof problemView>;
type Msg = { kind: "ok" | "error" | "warn" | "info"; text: string } | null;
type Failure = { name: string; lines: string[] } | null;

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

const show = (v: unknown) => JSON.stringify(v);

/** One interview problem: statement, editor, run examples / submit all, hints, interview mode, walkthrough. */
export function ProblemWorkspace({ view, next }: { view: View; next: { id: string; title: string } | null }) {
  const p = view.problem;
  const [state, setState] = useState<ProblemState>(view.state);
  const [code, setCode] = useState(view.state.code ?? p.starter);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [run, setRun] = useState<RunResult | null>(null);
  const [failure, setFailure] = useState<Failure>(null);
  const [primer, setPrimer] = useState<StepContent | null>(null);
  const [primerOpen, setPrimerOpen] = useState(false);
  const [sol, setSol] = useState<{ ref: string; complexity: string; editorial: Editorial } | null>(null);
  const [rebuild, setRebuild] = useState(false);
  const [bigO, setBigO] = useState<{ verdict: string; feedback: string } | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const saved = store.get(`ct-train-${p.id}`);
    if (saved) setCode(saved);
    setRebuild(store.get(`ct-rebuild-${p.id}`) === "1");
  }, [p.id]);

  // The interview clock.
  useEffect(() => {
    if (!state.interview) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [state.interview]);

  const edit = (c: string) => {
    setCode(c);
    store.set(`ct-train-${p.id}`, c);
  };

  const act = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    try {
      await fn();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
    setBusy(null);
  };

  /** Run the tests in the sandbox; returns whether every one passed. */
  const test = async (which: "examples" | "all") => {
    const r = await runCode(code, { tests: p.tests[which] });
    setRun(r);
    const failed = r.results?.find((t) => !t.passed);
    const passed = !r.error && !!r.results?.length && !failed;
    setFailure(failed ? { name: failed.name, lines: (failed.error ?? "").split("\n") } : r.error ? { name: "Your code crashed", lines: [r.error] } : null);
    return { passed, total: r.results?.length ?? 0, ok: r.results?.filter((t) => t.passed).length ?? 0 };
  };

  const runExamples = () =>
    act("examples", async () => {
      setMsg(null);
      const t = await test("examples");
      setMsg(
        t.passed
          ? { kind: "ok", text: `✔ All ${t.total} examples pass. Now **Submit** to run the ${p.hiddenCount} hidden tests too.` }
          : { kind: "error", text: `✖ ${t.ok} / ${t.total} examples pass.` },
      );
    });

  const submit = () =>
    act("submit", async () => {
      setMsg(null);
      const t = await test("all");
      const r = await post<{ passed: boolean; firstSolve: boolean; state: ProblemState }>(`/api/train/problem/${p.id}/submit`, { code, passed: t.passed });
      setState(r.state);
      if (t.passed) {
        setMsg({ kind: "ok", text: r.firstSolve ? `🎉 Accepted! All ${t.total} tests pass.` : `✔ Accepted again. All ${t.total} tests pass.` });
        if (rebuild) store.set(`ct-rebuild-${p.id}`, "0");
      } else setMsg({ kind: "error", text: `✖ Wrong answer: ${t.ok} / ${t.total} tests pass. Look at the failing test below.` });
    });

  const getHint = () =>
    act("hint", async () => {
      const r = await post<{ hint: string | null; reason?: string; state: ProblemState }>(`/api/train/problem/${p.id}/hint`, {
        code,
        failure: failure ? `${failure.name}\n${failure.lines.join("\n")}` : "",
      });
      setState(r.state);
      if (!r.hint) setMsg({ kind: "warn", text: r.reason ?? "No hint right now." });
    });

  const loadPrimer = () => {
    setPrimerOpen((o) => !o);
    if (primer) return;
    act("primer", async () => {
      const r = await post<{ content: StepContent }>(`/api/train/primer/${p.pattern.id}`);
      setPrimer(r.content);
    });
  };

  const openSolution = () =>
    act("solution", async () => {
      if (!state.solved && !confirm("If you look at the solution, this problem won't count as solved on your own. You'll study it, then rebuild it from memory. Continue?")) return;
      const r = await post<{ ref: string; complexity: string; editorial: Editorial; state: ProblemState }>(`/api/train/problem/${p.id}/solution`);
      setSol(r);
      setState(r.state);
    });

  const startRebuild = () => {
    setSol(null);
    setRebuild(true);
    store.set(`ct-rebuild-${p.id}`, "1");
    edit(p.starter);
    setRun(null);
    setFailure(null);
    setMsg({ kind: "warn", text: "Now rebuild it from memory. Pasting is turned off. Submit when it's ready." });
  };

  const interview = (action: "start" | "stop") =>
    act("interview", async () => {
      if (action === "start" && !confirm(`Interview mode: ${p.interviewMinutes} minutes on the clock, no hints. Beat the clock for bonus XP. Start?`)) return;
      const r = await post<{ state: ProblemState }>(`/api/train/problem/${p.id}/interview`, { action });
      setState(r.state);
      setNow(Date.now());
      if (action === "start" && !state.solved) setMsg({ kind: "info", text: "⏱ The clock is running. Think out loud: talk through your plan before you type, like in a real interview." });
    });

  const answerBigO = (answer: string) =>
    act("bigo", async () => {
      const r = await post<{ verdict: string; feedback: string; state: ProblemState }>(`/api/train/problem/${p.id}/complexity`, { answer });
      setBigO(r);
      setState(r.state);
    });

  const timeLeft = state.interview ? state.interview.start + state.interview.limitMs - now : 0;
  const clock = (ms: number) => {
    const s = Math.max(0, Math.floor(Math.abs(ms) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const hintsLeft = 3 - state.hints.length;
  const studying = state.solutionShown && !state.solved;

  return (
    <div className="workspace">
      <div className="ws-left">
        <div className="ws-title">
          <h1>{p.title}</h1>
          <div className="row">
            <span className={`diff diff-${p.difficulty}`}>{p.difficulty}</span>
            <span className="pill">{p.pattern.title}</span>
            {state.solved && <span className="pill ok">{state.studied ? "📖 studied" : "✓ solved"}</span>}
            {p.leetcode && (
              <a className="small" href={`https://leetcode.com/problems/${p.leetcode.slug}/`} target="_blank" rel="noreferrer">
                LeetCode {p.leetcode.n}: {p.leetcode.title} ↗
              </a>
            )}
          </div>
        </div>

        <div className="card tight">
          <Markdown>{p.statement}</Markdown>
          <ReadAloud text={p.statement} label="Read it to me" />
          <h3 className="small-head">Examples</h3>
          {p.examples.map((c, i) => (
            <div key={i} className="example">
              {p.design ? (
                <>
                  <div>
                    <b>Calls:</b> <code>{designCalls(p.fn, c.args)}</code>
                  </div>
                  <div>
                    <b>Returns:</b> <code>{show(c.out)}</code>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <b>Input:</b> <code>{c.args.map(show).join(", ")}</code>
                  </div>
                  <div>
                    <b>Output:</b> <code>{show(c.out)}</code>
                  </div>
                </>
              )}
            </div>
          ))}
          <p className="muted small">Plus {p.hiddenCount} hidden tests (edge cases!) when you Submit.</p>
        </div>

        <div className="card tight primer">
          <button type="button" className="btn ghost" onClick={loadPrimer} aria-expanded={primerOpen}>
            📘 {primerOpen ? "Hide" : "Learn"} the {p.pattern.title} pattern {busy === "primer" ? "…" : ""}
          </button>
          {!primerOpen && <p className="muted small">Stuck on where to even start? Learn the idea behind this kind of problem first, with a worked example.</p>}
          {primerOpen && busy === "primer" && <p className="muted">Your tutor is writing a lesson on this pattern (a minute the first time)…</p>}
          {primerOpen && primer && <DeepLesson title={p.pattern.title} content={primer} noAsk />}
        </div>
      </div>

      <div className="ws-right">
        <div className={`interview-bar ${state.interview ? (timeLeft < 0 ? "over" : "on") : ""}`}>
          {state.interview ? (
            <>
              <span className="clock">⏱ {timeLeft >= 0 ? clock(timeLeft) : `+${clock(timeLeft)}`}</span>
              <span className="small">{timeLeft >= 0 ? "Interview mode · no hints" : "Time's up. Finish anyway: real interviewers want to see you get there."}</span>
              <button type="button" className="btn ghost" onClick={() => interview("stop")} disabled={!!busy}>
                Stop
              </button>
            </>
          ) : (
            <>
              <span className="small">
                ⏱ <b>Interview mode</b>: {p.interviewMinutes} min, no hints{state.solved ? "" : ", bonus XP if you beat the clock"}.
                {state.interviewMs ? ` Your time: ${clock(state.interviewMs)}.` : ""}
              </span>
              <button type="button" className="btn ghost" onClick={() => interview("start")} disabled={!!busy}>
                Start
              </button>
            </>
          )}
        </div>

        {sol ? (
          <SolutionView sol={sol} solved={state.solved} onRebuild={state.solved ? () => setSol(null) : startRebuild} />
        ) : (
          <CodeBox code={code} onChange={edit} height={380} blockPaste={studying && rebuild}>
            <button type="button" className="btn secondary" onClick={runExamples} disabled={!!busy}>
              {busy === "examples" ? "Testing…" : "🧪 Run examples"}
            </button>
            <button type="button" className="btn" onClick={submit} disabled={!!busy}>
              {busy === "submit" ? "Judging…" : "🚀 Submit"}
            </button>
            {!state.solved && !state.solutionShown && !state.interview && (
              <button type="button" className="btn ghost" onClick={getHint} disabled={!!busy || !state.canHint.ok} title={state.canHint.reason}>
                {busy === "hint" ? "Thinking…" : `💡 Hint ${Math.min(state.hints.length + 1, 3)}/3`}
              </button>
            )}
            {state.canSeeSolution && (
              <button type="button" className="btn ghost" onClick={openSolution} disabled={!!busy}>
                {busy === "solution" ? "Loading…" : state.solved ? "📖 Walkthrough" : "🏳️ Show solution"}
              </button>
            )}
          </CodeBox>
        )}

        {msg && (
          <p className={msg.kind}>
            <InlineMd>{msg.text}</InlineMd>
          </p>
        )}
        {failure && !sol && (
          <div className="failure">
            <b>{failure.name.replace(/^.*?(Example|Hidden test)/, "$1")}</b>
            {failure.lines.map((l, i) => (
              <div key={i}>
                <code>{l}</code>
              </div>
            ))}
          </div>
        )}
        {run && !failure && run.logs.length > 0 && <Output result={{ ...run, results: null }} />}

        {state.hints.length > 0 && (
          <ol className="hints">
            {state.hints.map((h, i) => (
              <li key={i}>
                <InlineMd>{h}</InlineMd>
              </li>
            ))}
          </ol>
        )}
        {!state.solved && !state.solutionShown && !state.interview && !state.canHint.ok && hintsLeft > 0 && (
          <p className="muted small">{state.canHint.reason}</p>
        )}
        {!state.solved && !state.solutionShown && hintsLeft === 0 && !state.canSeeSolution && (
          <p className="muted small">
            The solution unlocks after {Math.max(0, 3 - state.failed)} more failed submit{3 - state.failed === 1 ? "" : "s"}. You can still crack it.
          </p>
        )}
        {studying && !sol && <p className="warn">You studied the solution. Rebuild it from memory and Submit to finish this problem.</p>}

        {state.solved && (
          <div className="card tight after-solve">
            <h3>🎤 The interviewer asks…</h3>
            <p className="big">“What’s the time and space complexity of your solution, and why?”</p>
            {state.complexityOk && !bigO ? (
              <p className="ok">✔ You already nailed this one.</p>
            ) : (
              <AnswerBox placeholder="e.g. O(n) time because… and O(1) space because…" busy={busy === "bigo"} submitLabel="Answer · +30 XP" onSubmit={answerBigO} />
            )}
            {bigO && (
              <div className={`bubble tutor ${bigO.verdict}`}>
                <div className="who">Interviewer</div>
                <InlineMd>{bigO.feedback}</InlineMd>
              </div>
            )}
            <div className="row" style={{ marginTop: 12 }}>
              {!sol && (
                <button type="button" className="btn secondary" onClick={openSolution} disabled={!!busy}>
                  📖 Compare with the model solution
                </button>
              )}
              {next && (
                <Link href={`/train/${next.id}`} className="btn">
                  Next: {next.title} →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function designCalls(cls: string, args: unknown[]): string {
  const [ctor, ops, argLists] = args as [unknown[], string[], unknown[][]];
  return [`new ${cls}(${ctor.map(show).join(", ")})`, ...ops.map((op, i) => `${op}(${argLists[i].map(show).join(", ")})`)].join(", ");
}

function SolutionView({ sol, solved, onRebuild }: { sol: { ref: string; complexity: string; editorial: Editorial }; solved: boolean; onRebuild: () => void }) {
  const e = sol.editorial;
  return (
    <div className="card tight solution">
      <h3>💡 The key idea</h3>
      <p className="big">
        <InlineMd>{e.idea}</InlineMd>
      </p>
      {e.steps.length > 0 && (
        <>
          <h3>🪜 Step by step</h3>
          <ol>
            {e.steps.map((s, i) => (
              <li key={i}>
                <InlineMd>{s}</InlineMd>
              </li>
            ))}
          </ol>
        </>
      )}
      <h3>🔍 The model solution, line by line</h3>
      {e.lines.length ? <Lines lines={e.lines} /> : <pre className="output">{sol.ref}</pre>}
      <h3>📈 Complexity</h3>
      <p>
        <InlineMd>{e.complexity || sol.complexity}</InlineMd>
      </p>
      {e.your_code && (
        <>
          <h3>🧑‍💻 Review of your code</h3>
          <p>
            <InlineMd>{e.your_code}</InlineMd>
          </p>
        </>
      )}
      {e.follow_up && (
        <div className="info">
          <b>Interview follow-up to think about:</b> <InlineMd>{e.follow_up}</InlineMd>
        </div>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button type="button" className="btn" onClick={onRebuild}>
          {solved ? "Back to my code" : "I’ve studied it. Hide it and let me rebuild it"}
        </button>
      </div>
    </div>
  );
}
