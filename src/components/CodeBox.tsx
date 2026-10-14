"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
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
  /** "html" shows the page in a safe preview box, with its console output below. */
  language?: "javascript" | "html";
};

/** Code editor with a Run button and an output panel. */
export function CodeBox({ code, onChange, height = 200, blockPaste, children, onRun, language = "javascript", ...props }: Props) {
  const [result, setResult] = useState<RunResult | null>(null);
  const [ownInputs, setOwnInputs] = useState("");
  const inputs = props.inputs ?? ownInputs;
  const setInputs = props.onInputsChange ?? setOwnInputs;
  const [running, setRunning] = useState(false);
  const [page, setPage] = useState<{ doc: string; n: number } | null>(null);
  const usesPrompt = language === "javascript" && /\b(prompt|confirm)\s*\(/.test(code);
  const blockRef = useRef(blockPaste);
  blockRef.current = blockPaste;

  const run = async () => {
    if (language === "html") {
      // Show the page; its console output arrives from the preview box as messages.
      setResult({ logs: [], error: null, results: null });
      setPage((p) => ({ doc: CAPTURE + code, n: (p?.n ?? 0) + 1 }));
      return;
    }
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
          defaultLanguage={language}
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
      {page && <PagePreview key={page.n} doc={page.doc} onLog={(l) => setResult((r) => ({ logs: [...(r?.logs ?? []), l], error: null, results: null }))} />}
      {result && language === "javascript" && <Output result={result} />}
      {result && language === "html" && result.logs.length > 0 && (
        <div className="preview">
          <div className="preview-bar">The console (what console.log printed)</div>
          <Output result={result} />
        </div>
      )}
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

// Injected first into an HTML preview so console.log / alert / errors show up below it.
const CAPTURE = `<script>(function(){var s=function(t,a){parent.postMessage({__ct:1,type:t,text:[].map.call(a,function(x){return typeof x==="string"?x:JSON.stringify(x)}).join(" ")},"*")};console.log=function(){s("log",arguments)};console.info=console.log;console.warn=function(){s("warn",arguments)};console.error=function(){s("error",arguments)};window.alert=function(m){s("alert",[String(m)])};window.onerror=function(m){s("error",[m])}})();</script>`;

/** A web page rendered in a sandboxed box: scripts run, but can't touch this app. */
function PagePreview({ doc, onLog }: { doc: string; onLog: (l: { type: "log" | "warn" | "error" | "alert"; text: string }) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const cb = useRef(onLog);
  cb.current = onLog;
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data?.__ct) return;
      cb.current({ type: e.data.type, text: String(e.data.text) });
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);
  return (
    <div className="preview">
      <div className="preview-bar">The web page</div>
      <iframe ref={frame} title="Page preview" sandbox="allow-scripts" srcDoc={doc} />
    </div>
  );
}
