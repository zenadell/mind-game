"use client";

import { useEffect, useRef, useState } from "react";

const SIZES = [
  { id: "s", label: "A", title: "Small text" },
  { id: "m", label: "A", title: "Normal text" },
  { id: "l", label: "A", title: "Large text" },
  { id: "xl", label: "A", title: "Extra large text" },
];

function read(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

/** "Aa" menu: text size and read-aloud speed, remembered on this device. */
export function ReadingPrefs() {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState("m");
  const [rate, setRate] = useState(0.95);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSize(read("ct-size", "m"));
    setRate(Number(read("ct-rate", "0.95")));
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const pickSize = (id: string) => {
    setSize(id);
    write("ct-size", id);
    document.documentElement.dataset.size = id;
  };
  const pickRate = (v: number) => {
    setRate(v);
    write("ct-rate", String(v));
  };
  const sample = () => {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("This is how fast I will read to you.");
    u.rate = rate;
    speechSynthesis.speak(u);
  };

  return (
    <div className="prefs" ref={box}>
      <button type="button" className="btn ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Reading settings" title="Reading settings">
        Aa
      </button>
      {open && (
        <div className="prefs-panel" role="dialog" aria-label="Reading settings">
          <h4>Text size</h4>
          <div className="seg">
            {SIZES.map((s, i) => (
              <button key={s.id} className={size === s.id ? "on" : ""} onClick={() => pickSize(s.id)} title={s.title} style={{ fontSize: `${0.8 + i * 0.18}rem` }}>
                {s.label}
              </button>
            ))}
          </div>
          <h4>Reading speed</h4>
          <input type="range" min={0.6} max={1.3} step={0.05} value={rate} onChange={(e) => pickRate(Number(e.target.value))} aria-label="Reading speed" />
          <div className="row" style={{ justifyContent: "space-between", margin: "4px 0 0" }}>
            <span className="small muted">{rate < 0.85 ? "Slow" : rate > 1.1 ? "Fast" : "Normal"}</span>
            <button type="button" className="link" onClick={sample}>
              ▶ Try it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
