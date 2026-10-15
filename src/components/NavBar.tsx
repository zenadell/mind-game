"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ReadingPrefs } from "./ReadingPrefs";

type Game = {
  level: { n: number; name: string; into: number; need: number };
  daily: { xp: number; goal: number };
  streak: number;
  freezes: number;
};

type Stats = { streak: number; costToday: number; costTotal: number; tokensToday: number; completed: number; reviewsDue: number };

const LINKS = [
  { href: "/", label: "Learn" },
  { href: "/review", label: "Review" },
  { href: "/report", label: "Report" },
  { href: "/settings", label: "Settings" },
];

/** Top bar: navigation, reviews waiting, streak, today's AI usage, reading preferences. */
export function NavBar() {
  const path = usePathname();
  const [s, setS] = useState<Stats | null>(null);
  const [g, setG] = useState<Game | null>(null);
  useEffect(() => {
    const load = () => {
      fetch("/api/stats")
        .then((r) => r.json())
        .then(setS)
        .catch(() => {});
      fetch("/api/game")
        .then((r) => r.json())
        .then(setG)
        .catch(() => {});
    };
    load();
    window.addEventListener("ct-stats", load);
    window.addEventListener("ct-game", load);
    return () => {
      window.removeEventListener("ct-stats", load);
      window.removeEventListener("ct-game", load);
    };
  }, [path]);

  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/lesson") || path.startsWith("/quiz") : path.startsWith(href));

  return (
    <header className="top">
      <div className="top-inner">
        <Link href="/" className="brand" aria-label="CodeTutor home">
          <span className="brand-mark" aria-hidden>{"{ }"}</span>
          CodeTutor
        </Link>
        <nav className="nav" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={active(l.href) ? "active" : ""} aria-current={active(l.href) ? "page" : undefined}>
              {l.label}
              {l.href === "/review" && s && s.reviewsDue > 0 && (
                <span className="badge" aria-label={`${s.reviewsDue} due`}>
                  {s.reviewsDue}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="top-right">
          {g && (
            <div className="game-bar">
              <span className="lvl" title={`${g.level.name}: ${g.level.into} / ${g.level.need} XP to level ${g.level.n + 1}`}>
                <span className="lvl-n">{g.level.n}</span>
                <span className="lvl-bar">
                  <span style={{ width: `${(g.level.into / g.level.need) * 100}%` }} />
                </span>
              </span>
              <Ring value={g.daily.xp} max={g.daily.goal} />
              <span className="flame" title={`${g.streak} days in a row${g.freezes ? ` · ${g.freezes} streak freeze${g.freezes > 1 ? "s" : ""} ready` : ""}`}>
                🔥 {g.streak}
                {g.freezes > 0 && <span className="freeze"> ❄️{g.freezes}</span>}
              </span>
            </div>
          )}
          {s && (
            <div className="stats">
              {s.costToday > 0 || s.tokensToday === 0 ? (
                <span title={`AI cost so far: $${s.costTotal.toFixed(2)} in total`}>${s.costToday.toFixed(3)}</span>
              ) : (
                <span title="AI use today. Add your model's prices in Settings to see dollars.">{(s.tokensToday / 1000).toFixed(0)}k tok</span>
              )}
            </div>
          )}
          <ReadingPrefs />
        </div>
      </div>
    </header>
  );
}

/** Today's XP toward the daily goal, as a ring that fills up. */
export function Ring({ value, max, size = 30 }: { value: number; max: number; size?: number }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const done = value >= max;
  return (
    <span className={`ring ${done ? "done" : ""}`} title={`Daily goal: ${value} / ${max} XP`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ring-fg"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, value / max))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="ring-label">{done ? "✓" : "🎯"}</span>
    </span>
  );
}
