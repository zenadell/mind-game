"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ReadingPrefs } from "./ReadingPrefs";

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
  useEffect(() => {
    const load = () =>
      fetch("/api/stats")
        .then((r) => r.json())
        .then(setS)
        .catch(() => {});
    load();
    window.addEventListener("ct-stats", load);
    return () => window.removeEventListener("ct-stats", load);
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
          {s && (
            <div className="stats">
              <span className="flame" title="Days in a row you learned something">
                🔥 {s.streak}
              </span>
              <span title="Lessons completed">✓ {s.completed}</span>
              {s.costToday > 0 || s.tokensToday === 0 ? (
                <span title={`AI cost so far: $${s.costTotal.toFixed(2)} in total`}>${s.costToday.toFixed(3)} today</span>
              ) : (
                <span title="Add your model's prices in Settings to see the cost in dollars">{(s.tokensToday / 1000).toFixed(1)}k tokens today</span>
              )}
            </div>
          )}
          <ReadingPrefs />
        </div>
      </div>
    </header>
  );
}
