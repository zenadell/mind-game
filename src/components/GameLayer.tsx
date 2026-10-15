"use client";

import { useEffect, useRef, useState } from "react";
import type { GameEvent } from "@/lib/game";
import { play, type Sound } from "@/lib/sound";

type Toast = { id: number; kind: "xp" | "badge" | "goal"; title: string; sub?: string; emoji?: string };

/**
 * Celebrations for every win: XP pop-ups, combo flames, badges, the daily goal, and a
 * level-up moment with confetti. Listens for "ct-game" events sent by the API helper.
 */
export function GameLayer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [levelUp, setLevelUp] = useState<{ n: number; name: string } | null>(null);
  const confetti = useRef<HTMLCanvasElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    const push = (t: Omit<Toast, "id">, ms: number) => {
      const id = nextId.current++;
      setToasts((all) => [...all.slice(-3), { ...t, id }]);
      setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), ms);
    };
    const onGame = (e: Event) => {
      const g = (e as CustomEvent<GameEvent>).detail;
      if (!g || !g.gained) return;
      push(
        {
          kind: "xp",
          title: `+${g.gained} XP`,
          sub: g.multiplier > 1 ? `🔥 ${g.combo} in a row · x${g.multiplier} combo!` : g.label,
        },
        2800,
      );
      let sound: Sound = g.multiplier > 1 ? "combo" : "xp";
      g.badges.forEach((b, i) =>
        setTimeout(() => {
          push({ kind: "badge", title: `Achievement: ${b.title}`, sub: b.desc, emoji: b.emoji }, 4500);
          play("badge");
        }, 600 + i * 700),
      );
      if (g.goalReached) {
        push({ kind: "goal", title: "Daily goal reached! 🎯", sub: `${g.daily.xp} / ${g.daily.goal} XP today. Keep the streak alive tomorrow.` }, 5000);
        sound = "goal";
        burst(confetti.current, 90);
      }
      if (g.gained >= 100 && !g.goalReached && !g.leveledUp) burst(confetti.current, 70); // lesson done, boss beaten
      if (g.leveledUp) {
        setLevelUp(g.leveledUp);
        sound = "level";
        burst(confetti.current, 160);
      }
      play(sound);
    };
    const onSound = (e: Event) => play((e as CustomEvent<Sound>).detail);
    window.addEventListener("ct-game", onGame);
    window.addEventListener("ct-sound", onSound);
    return () => {
      window.removeEventListener("ct-game", onGame);
      window.removeEventListener("ct-sound", onSound);
    };
  }, []);

  return (
    <>
      <canvas ref={confetti} className="confetti" aria-hidden />
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.emoji && <span className="toast-emoji">{t.emoji}</span>}
            <div>
              <b>{t.title}</b>
              {t.sub && <div className="small">{t.sub}</div>}
            </div>
          </div>
        ))}
      </div>
      {levelUp && (
        <div className="levelup" role="dialog" aria-label="Level up" onClick={() => setLevelUp(null)}>
          <div className="levelup-card" onClick={(e) => e.stopPropagation()}>
            <div className="levelup-badge">{levelUp.n}</div>
            <p className="step-label">Level up!</p>
            <h2>You’re now a {levelUp.name}</h2>
            <p className="muted">Every level is proof you’re turning into a developer. Keep going.</p>
            <button className="btn big-btn" onClick={() => setLevelUp(null)} autoFocus>
              Keep going →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** A burst of confetti on a full-screen canvas. */
function burst(canvas: HTMLCanvasElement | null, count: number) {
  if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ["#2c58cf", "#17734a", "#d9480f", "#f3c565", "#8eb0ff", "#e64980"];
  const parts = Array.from({ length: count }, () => ({
    x: canvas.width / 2 + (Math.random() - 0.5) * 200,
    y: canvas.height / 3,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 12 - 4,
    size: 5 + Math.random() * 6,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.vy += 0.35;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - t / 2600);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (t < 2600) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  requestAnimationFrame(frame);
}
