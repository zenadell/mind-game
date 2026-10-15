"use client";

// Tiny sound effects made with the Web Audio API (no files). Can be turned off in Aa settings.

let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  try {
    return localStorage.getItem("ct-sound") !== "off";
  } catch {
    return true;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", vol = 0.12) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.05);
}

export type Sound = "xp" | "combo" | "level" | "badge" | "goal" | "wrong";

export function play(s: Sound) {
  if (!soundOn()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    return;
  }
  switch (s) {
    case "xp":
      tone(880, 0, 0.12);
      tone(1320, 0.07, 0.18);
      break;
    case "combo":
      [660, 880, 1100, 1320].forEach((f, i) => tone(f, i * 0.05, 0.15, "triangle"));
      break;
    case "level":
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.3, "triangle", 0.14));
      break;
    case "badge":
      [784, 988, 1175].forEach((f, i) => tone(f, i * 0.08, 0.25, "sine", 0.13));
      break;
    case "goal":
      [523, 784, 659, 1047].forEach((f, i) => tone(f, i * 0.12, 0.35, "triangle", 0.14));
      break;
    case "wrong":
      tone(330, 0, 0.18, "sine", 0.08);
      tone(262, 0.12, 0.25, "sine", 0.08);
      break;
  }
}
