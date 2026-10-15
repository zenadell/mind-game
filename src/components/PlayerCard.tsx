"use client";

import { useState } from "react";
import { post } from "@/lib/client";
import { Ring } from "./NavBar";

type Badge = { id: string; emoji: string; title: string; desc: string; earnedAt: number | null };
type State = {
  total: number;
  level: { n: number; name: string; into: number; need: number };
  daily: { xp: number; goal: number };
  combo: number;
  comboBest: number;
  streak: number;
  freezes: number;
  badges: Badge[];
};

const GOAL_NAMES: Record<number, string> = { 50: "Casual", 100: "Regular", 200: "Serious" };

/** Level, XP to the next level, today's goal, streak and achievements. */
export function PlayerCard({ initial }: { initial: State }) {
  const [g, setG] = useState(initial);
  const left = g.level.need - g.level.into;
  const goalLeft = Math.max(0, g.daily.goal - g.daily.xp);
  const earned = g.badges.filter((b) => b.earnedAt);

  const setGoal = async (goal: number) => {
    const r = await post<{ state: State }>("/api/game", { action: "goal", goal });
    setG(r.state);
  };

  return (
    <section className="card player">
      <div className="player-top">
        <div className="levelup-badge small-badge">{g.level.n}</div>
        <div className="player-level">
          <div className="step-label">Level {g.level.n}</div>
          <div className="player-name">{g.level.name}</div>
          <div className="lvl-bar wide">
            <span style={{ width: `${(g.level.into / g.level.need) * 100}%` }} />
          </div>
          <div className="small muted">
            {g.level.into} / {g.level.need} XP · <b>{left} XP</b> to level {g.level.n + 1} (about {Math.max(1, Math.ceil(left / 30))} parts)
          </div>
        </div>
        <div className="player-goal">
          <Ring value={g.daily.xp} max={g.daily.goal} size={64} />
          <div>
            <div className="step-label">Today</div>
            <div className="player-name">
              {g.daily.xp} / {g.daily.goal} XP
            </div>
            <div className="small muted">{goalLeft ? `${goalLeft} XP to your daily goal` : "Daily goal done! 🎯"}</div>
          </div>
        </div>
      </div>

      <div className="player-stats">
        <span>
          🔥 <b>{g.streak}</b> day streak
          {g.freezes > 0 && <span className="freeze"> · ❄️ {g.freezes} freeze{g.freezes > 1 ? "s" : ""} ready</span>}
        </span>
        <span>
          ⚡ best combo <b>{g.comboBest}</b>
        </span>
        <span>
          ⭐ <b>{g.total}</b> XP total
        </span>
        <span className="goal-pick">
          Daily goal:
          {[50, 100, 200].map((n) => (
            <button key={n} type="button" className={`chip ${g.daily.goal === n ? "on" : ""}`} onClick={() => setGoal(n)}>
              {GOAL_NAMES[n]} {n}
            </button>
          ))}
        </span>
      </div>
      {g.streak >= 1 && g.streak < 7 && (
        <p className="small muted">Keep a 7-day streak to earn a ❄️ streak freeze: it saves your streak if you miss a day.</p>
      )}

      <details className="badges">
        <summary>
          🏆 Achievements: <b>{earned.length}</b> of {g.badges.length}
        </summary>
        <div className="badge-grid">
          {g.badges.map((b) => (
            <div key={b.id} className={`badge-tile ${b.earnedAt ? "earned" : ""}`} title={b.desc}>
              <span className="badge-emoji">{b.earnedAt ? b.emoji : "🔒"}</span>
              <b>{b.title}</b>
              <span className="small muted">{b.desc}</span>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
