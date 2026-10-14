"use client";

import { useEffect, useRef, useState } from "react";

/** Read text aloud with the browser's built-in voice. */
export function ReadAloud({ text, label = "Read aloud" }: { text: string; label?: string }) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  if (typeof window !== "undefined" && !("speechSynthesis" in window)) return null;
  const toggle = () => {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(forSpeech(text));
    u.rate = Number(localStorage.getItem("ct-rate") || 0.95);
    u.onend = u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  };
  return (
    <button type="button" className="btn secondary" onClick={toggle} aria-pressed={speaking}>
      {speaking ? "■ Stop" : `🔊 ${label}`}
    </button>
  );
}

/** Make Markdown/code friendlier for a speech voice. */
function forSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " (see the code example) ")
    .replace(/[`*_#>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

/** Speak instead of typing. Appends what was heard via onText. */
export function MicButton({ onText }: { onText: (t: string) => void }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => rec.current?.stop();
  }, []);
  if (!supported) return null;
  const toggle = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const w = window as unknown as Record<string, new () => SpeechRecognitionLike>;
    const R = w.SpeechRecognition || w.webkitSpeechRecognition;
    const r = new R();
    r.lang = "en-NG";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) if (e.results[i].isFinal) text = e.results[i][0].transcript;
      if (text) onText(text.trim());
    };
    r.onerror = (e) => setError(e.error === "not-allowed" ? "Allow the microphone to use voice." : "Voice input stopped.");
    r.onend = () => setListening(false);
    rec.current = r;
    setError(null);
    setListening(true);
    r.start();
  };
  return (
    <span className="mic">
      <button type="button" className={`btn secondary ${listening ? "recording" : ""}`} onClick={toggle} aria-pressed={listening}>
        {listening ? "● Listening… tap to stop" : "🎤 Speak"}
      </button>
      {error && <small className="muted"> {error}</small>}
    </span>
  );
}
