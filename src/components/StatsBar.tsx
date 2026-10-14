"use client";

import { useEffect, useState } from "react";

type Stats = { streak: number; costToday: number; costTotal: number; completed: number };

/** Streak, lessons done, and the running API cost. */
export function StatsBar() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    const load = () =>
      fetch("/api/stats")
        .then((r) => r.json())
        .then(setS)
        .catch(() => {});
    load();
    window.addEventListener("ct-stats", load);
    return () => window.removeEventListener("ct-stats", load);
  }, []);
  if (!s) return null;
  return (
    <div className="stats" aria-label="Your stats">
      <span title="Days in a row">🔥 {s.streak} day{s.streak === 1 ? "" : "s"}</span>
      <span title="Lessons completed">✔ {s.completed} lessons</span>
      <span title={`API cost so far: $${s.costTotal.toFixed(2)} total`}>💲{s.costToday.toFixed(3)} today</span>
    </div>
  );
}
