import type { Metadata } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

// Atkinson Hyperlegible: made by the Braille Institute so letters are easy to tell apart.
const body = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "CodeTutor",
  description: "Learn JavaScript one small idea at a time, with a tutor that checks you really understand.",
};

// Apply the saved text size before the page paints, so it doesn't jump.
const applySize = `try{var s=localStorage.getItem("ct-size");if(s)document.documentElement.dataset.size=s}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={body.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applySize }} />
      </head>
      <body>
        <NavBar />
        <div className="page">{children}</div>
        <footer className="foot">
          Lessons adapted from <a href="https://javascript.info">javascript.info</a> by Ilya Kantor, used under CC BY-NC for
          personal, non-commercial learning.
        </footer>
      </body>
    </html>
  );
}
