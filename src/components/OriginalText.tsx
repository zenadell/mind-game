"use client";

import { isValidElement, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { askTutor, post } from "@/lib/client";
import type { CodeExplain } from "@/lib/prompts";
import { CodeBox } from "./CodeBox";
import { Lines } from "./DeepLesson";
import { InlineMd } from "./Markdown";

/** Text inside a rendered element (the code of a <pre><code>). */
function textOf(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: React.ReactNode }).children);
  return "";
}

function langOf(node: React.ReactNode): string {
  if (isValidElement(node)) {
    const cls = (node.props as { className?: string }).className ?? "";
    return cls.match(/language-(\w+)/)?.[1] ?? "";
  }
  return "";
}

/**
 * The original lesson text, exactly as the author wrote it, with help built in:
 * every code example gets "Try it" and "Explain line by line", and any sentence can be
 * selected and sent to the tutor.
 */
export function OriginalText({ md, stepId, title }: { md: string; stepId: number; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [pick, setPick] = useState<{ text: string; x: number; y: number } | null>(null);

  // Show an "Explain this" button next to selected text.
  const onSelect = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!sel || !text || text.length < 2 || !box.current || !box.current.contains(sel.anchorNode)) {
      setPick(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const outer = box.current.getBoundingClientRect();
    setPick({ text: text.slice(0, 600), x: Math.min(rect.left - outer.left, outer.width - 160), y: rect.bottom - outer.top + 6 });
  };
  useEffect(() => {
    const clear = () => setPick(null);
    window.addEventListener("scroll", clear, { passive: true });
    return () => window.removeEventListener("scroll", clear);
  }, []);

  let block = -1; // which code example we are rendering (in order)
  return (
    <div className="original-text md" ref={box} onMouseUp={onSelect} onKeyUp={onSelect} onTouchEnd={() => setTimeout(onSelect, 50)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
          pre: ({ children }) => {
            block++;
            return <CodeTools key={block} stepId={stepId} index={block} code={textOf(children).replace(/\n$/, "")} lang={langOf(children)} />;
          },
        }}
      >
        {md}
      </ReactMarkdown>
      {pick && (
        <button
          type="button"
          className="btn explain-pick"
          style={{ left: Math.max(0, pick.x), top: pick.y }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            askTutor(`In the section "${title}" of my lesson, I don't understand this part: "${pick.text}". What does it mean? Please explain it from zero, including any words or symbols in it.`);
            setPick(null);
            window.getSelection()?.removeAllRanges();
          }}
        >
          🙋 Explain this
        </button>
      )}
    </div>
  );
}

/** A code example from the lesson, with Try it and Explain line by line. */
function CodeTools({ stepId, index, code, lang }: { stepId: number; index: number; code: string; lang: string }) {
  const runnable = ["js", "javascript", "html"].includes(lang) && !/^\s*$/.test(code);
  const [trying, setTrying] = useState(false);
  const [edited, setEdited] = useState(code);
  const [explain, setExplain] = useState<CodeExplain | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExplain = async () => {
    if (explain) {
      setExplain(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setExplain(await post<CodeExplain>(`/api/step/${stepId}/code/${index}`));
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <div className="code-example">
      <pre>
        <code>{code}</code>
      </pre>
      <div className="code-actions">
        {runnable && (
          <button type="button" className="btn secondary" onClick={() => setTrying((t) => !t)}>
            {trying ? "Hide editor" : "▶ Try it"}
          </button>
        )}
        <button type="button" className="btn secondary" onClick={loadExplain} disabled={busy}>
          {busy ? "Explaining…" : explain ? "Hide explanation" : "🔍 Explain line by line"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {explain && (
        <div className="code-explain">
          <Lines lines={explain.lines} />
          {explain.result && (
            <p className="info">
              <b>When it runs:</b> <InlineMd>{explain.result}</InlineMd>
            </p>
          )}
        </div>
      )}
      {trying && (
        <CodeBox
          code={edited}
          onChange={setEdited}
          height={Math.min(320, 40 + code.split("\n").length * 24)}
          language={lang === "html" ? "html" : "javascript"}
        />
      )}
    </div>
  );
}
