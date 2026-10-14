"use client";

import { useEffect, useRef, useState } from "react";
import { AnswerBox } from "./AnswerBox";
import { Markdown } from "./Markdown";
import { ReadAloud } from "./Speech";

type Msg = { role: "user" | "assistant"; content: string };

/** Chat with the tutor about this lesson only. */
export function TutorChat({ lessonId, initial }: { lessonId: string; initial: Msg[] }) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [messages]);

  const send = async (text: string) => {
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    try {
      const res = await fetch(`/api/lesson/${lessonId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.body) throw new Error((await res.json()).error);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const piece = dec.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + piece };
          return copy;
        });
      }
    } catch (err) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: `⚠️ ${(err as Error).message}` };
        return copy;
      });
    }
    window.dispatchEvent(new Event("ct-stats"));
    setBusy(false);
  };

  // "Explain this more simply" buttons in the lesson send their question here.
  const sendRef = useRef(send);
  sendRef.current = send;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  useEffect(() => {
    const ask = (e: Event) => {
      if (busyRef.current) return;
      box.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      sendRef.current((e as CustomEvent<string>).detail);
    };
    window.addEventListener("ct-ask", ask);
    return () => window.removeEventListener("ct-ask", ask);
  }, []);

  return (
    <aside className="chat card" ref={box}>
      <h3>Ask your tutor</h3>
      <p className="muted small">Ask anything about this lesson, as many times as you need. The tutor explains, but never writes exercise answers.</p>
      <div className="messages">
        {messages.length === 0 && <p className="muted">Stuck on an idea? Ask anything about this lesson.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === "assistant" ? (
              <>
                <Markdown>{m.content || "…"}</Markdown>
                {m.content && !busy && <ReadAloud text={m.content} label="Listen" />}
              </>
            ) : (
              <p>{m.content}</p>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>
      <AnswerBox placeholder="Type or speak your question…" rows={2} busy={busy} submitLabel="Send" onSubmit={send} clearOnSubmit />
    </aside>
  );
}
