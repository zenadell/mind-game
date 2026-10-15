"use client";

import { useState } from "react";
import { askTutor } from "@/lib/client";
import type { StepContent } from "@/lib/prompts";
import { CodeBox } from "./CodeBox";
import { InlineMd } from "./Markdown";
import { ReadAloud } from "./Speech";

type Piece = { key: string; icon: string; title: string; speak: string; body: React.ReactNode };

/** The tutor's from-zero explanation of a section: why, words, how, picture it, code, real life. */
export function DeepLesson({ title, content: c }: { title: string; content: StepContent }) {
  const [code, setCode] = useState(c.example.lines.map((l) => l.code).join("\n"));
  const pieces: Piece[] = [
    { key: "why", icon: "💡", title: "Why this matters", speak: c.why, body: <p className="big"><InlineMd>{c.why}</InlineMd></p> },
  ];
  if (c.new_words.length)
    pieces.push({
      key: "words",
      icon: "📖",
      title: "New words",
      speak: c.new_words.map((w) => `${w.word}. ${w.meaning}`).join(" "),
      body: <Words words={c.new_words} />,
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
  if (c.analogy) pieces.push({ key: "picture", icon: "🧠", title: "Picture it", speak: c.analogy, body: <p className="analogy"><InlineMd>{c.analogy}</InlineMd></p> });
  if (c.example.language !== "none" && c.example.lines.length)
    pieces.push({
      key: "code",
      icon: "🔍",
      title: "The code, line by line",
      speak: c.example.lines.filter((l) => l.explain).map((l) => l.explain).join(" "),
      body: (
        <>
          <Lines lines={c.example.lines} />
          <p className="muted">
            Try it: press Run{c.output ? <> and you should see <code>{c.output.split("\n")[0]}</code></> : ""}. Then change something and run it again.
          </p>
          <CodeBox code={code} onChange={setCode} height={Math.min(260, 40 + c.example.lines.length * 24)} language={c.example.language} />
        </>
      ),
    });
  if (c.real_world || c.mistakes.length)
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

  return (
    <>
      {pieces.map((p) => (
        <div key={p.key} className="piece">
          <h3>
            <span aria-hidden>{p.icon}</span> {p.title}
          </h3>
          {p.body}
          <div className="piece-actions">
            <ReadAloud text={p.speak} label="Listen" />
            <button
              type="button"
              className="btn ghost"
              onClick={() => askTutor(`I don't fully understand this part of "${title}" (${p.title}): "${p.speak.slice(0, 600)}". Can you explain it more simply, from zero?`)}
            >
              🙋 Still confusing? Ask the tutor
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

export function Words({ words }: { words: { word: string; meaning: string }[] }) {
  return (
    <div className="words">
      {words.map((w) => (
        <div key={w.word} className="word">
          <b>{w.word}</b> — <InlineMd>{w.meaning}</InlineMd>
        </div>
      ))}
    </div>
  );
}

export function Lines({ lines }: { lines: { code: string; explain: string }[] }) {
  return (
    <div className="lines">
      {lines.map((l, i) =>
        !l.code.trim() && !l.explain.trim() ? null : (
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
        ),
      )}
    </div>
  );
}
