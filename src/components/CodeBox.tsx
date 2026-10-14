"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { runCode, type RunResult } from "@/lib/sandbox";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="editor-loading">Loading editor…</div>,
});

type Props = {
  code: string;
  onChange?: (code: string) => void;
  height?: number;
  /** Stops pasting (used when retyping a solution from memory). */
  blockPaste?: boolean;
  /** Extra buttons next to Run. */
  children?: React.ReactNode;
  onRun?: (r: RunResult) => void;
  /** Lines fed to prompt()/confirm(); pass these to control them from outside. */
  inputs?: string;
  onInputsChange?: (s: string) => void;
};

/** Code editor with a Run button and an output panel. */
export function CodeBox({ code, onChange, height = 200, blockPaste, children, onRun, ...props }: Props) {
  const [result, setResult] = useState<RunResult | null>(null);
  const [ownInputs, setOwnInputs] = useState("");
  const inputs = props.inputs ?? ownInputs;
  const setInputs = props.onInputsChange ?? setOwnInputs;
  const [running, setRunning] = useState(false);
  const usesPrompt = /\b(prompt|confirm)\s*\(/.test(code);
  const blockRef = useRef(blockPaste);
  blockRef.current = blockPaste;

  const run = async () => {
    setRunning(true);
    const r = await runCode(code, { inputs: splitInputs(inputs) });
    setResult(r);
    setRunning(false);
    onRun?.(r);
  };

  return (
    <div className="codebox">
      <div className="editor" style={{ height }}>
        <Editor
          height={height}
          defaultLanguage="javascript"
          value={code}
          onChange={(v) => onChange?.(v ?? "")}
          theme="vs-dark"
          options={{
            fontSize: 17,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: "on",
            tabSize: 2,
            wordWrap: "on",
            readOnly: !onChange,
            quickSuggestions: false, // no autocomplete: type it yourself
            suggestOnTriggerCharacters: false,
          }}
          onMount={(editor) => {
            editor.onDidPaste((e) => {
              if (blockRef.current) {
                editor.executeEdits("no-paste", [{ range: e.range, text: "" }]);
              }
            });
          }}
        />
      </div>
      {usesPrompt && (
        <label className="inputs">
          Answers for <code>prompt()</code> / <code>confirm()</code>, one per line:
          <textarea rows={2} value={inputs} onChange={(e) => setInputs(e.target.value)} placeholder={"e.g.\n25"} />
        </label>
      )}
      <div className="row">
        <button type="button" className="btn" onClick={run} disabled={running}>
          ▶ Run
        </button>
        {children}
      </div>
      {result && <Output result={result} />}
    </div>
  );
}

export function splitInputs(s: string): string[] {
  return s.split("\n").filter((l, i, all) => l !== "" || i < all.length - 1);
}

export function Output({ result }: { result: RunResult }) {
  if (!result.logs.length && !result.error && !result.results)
    return <pre className="output muted">(Your code ran but printed nothing. Use console.log or alert to see values.)</pre>;
  return (
    <pre className="output">
      {result.logs.map((l, i) => (
        <div key={i} className={`log-${l.type}`}>
          {l.type === "alert" ? "🔔 " : l.type === "prompt" ? "❓ " : ""}
          {l.text}
        </div>
      ))}
      {result.error && <div className="log-error">✖ {result.error}</div>}
      {result.results?.map((t, i) => (
        <div key={`t${i}`} className={t.passed ? "log-pass" : "log-error"}>
          {t.passed ? "✔" : "✖"} {t.name}
          {t.error ? ` — ${t.error}` : ""}
        </div>
      ))}
    </pre>
  );
}
