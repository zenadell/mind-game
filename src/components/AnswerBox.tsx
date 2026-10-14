"use client";

import { useState } from "react";
import { MicButton } from "./Speech";

/** A text answer the learner can type or speak. */
export function AnswerBox({
  placeholder,
  rows = 3,
  busy,
  submitLabel = "Submit",
  onSubmit,
  clearOnSubmit,
}: {
  clearOnSubmit?: boolean;
  placeholder: string;
  rows?: number;
  busy?: boolean;
  submitLabel?: string;
  onSubmit: (text: string) => void | Promise<void>;
}) {
  const [text, setText] = useState("");
  return (
    <form
      className="answer"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim() || busy) return;
        const t = text.trim();
        if (clearOnSubmit) setText("");
        await onSubmit(t);
      }}
    >
      <textarea rows={rows} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} />
      <div className="row">
        <button className="btn" disabled={busy || !text.trim()}>
          {busy ? "Checking…" : submitLabel}
        </button>
        <MicButton onText={(t) => setText((old) => (old ? old + " " : "") + t)} />
      </div>
    </form>
  );
}
