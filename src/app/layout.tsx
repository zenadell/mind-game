import type { Metadata } from "next";
import Link from "next/link";
import { StatsBar } from "@/components/StatsBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodeTutor",
  description: "Learn JavaScript one small idea at a time, with a tutor that checks you really understand.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <Link href="/" className="brand">
            🧑🏾‍🏫 CodeTutor
          </Link>
          <div className="top-right">
            <StatsBar />
            <Link href="/settings" title="Settings">⚙️ Settings</Link>
          </div>
        </header>
        <div className="page">{children}</div>
        <footer className="foot">
          Lessons adapted from <a href="https://javascript.info">javascript.info</a> by Ilya Kantor, used under CC BY-NC for
          personal, non-commercial learning.
        </footer>
      </body>
    </html>
  );
}
