"use client";

import { useState } from "react";
import { post } from "@/lib/client";
import type { Reexplain } from "@/lib/prompts";
import { AnswerBox } from "./AnswerBox";
import { InlineMd } from "./Markdown";
import { ReadAloud } from "./Speech";

type Verdict = { verdict: "correct" | "partly" | "wrong"; feedback: string };
/** The "Your turn" conversation: the learner's tries and the tutor's replies. */
type Turn = { who: "learner" | "tutor"; text: string; verdict?: Verdict["verdict"] };

/** Misses before the tutor re-explains the section another way. */
const MISSES_BEFORE_REEXPLAIN = 3;

/** One check question, answered as a short conversation with the tutor. */
export function CheckChat({
  stepId,
  question: firstQuestion,
  answerKey: firstKey,
  passed: alreadyPassed,
  onPassed,
}: {
  stepId: number;
  question: string;
  answerKey: string;
  passed: boolean;
  onPassed: () => void;
}) {
  const [thread, setThread] = useState<Turn[]>([]);
  const [again, setAgain] = useState<Reexplain | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const question = again?.question ?? firstQuestion;
  const answerKey = again?.answer_key ?? firstKey;

  const answer = async (text: string) => {
    setBusy(true);
    setError(null);
    setThread((t) => [...t, { who: "learner", text }]);
    try {
      const history = thread.map(({ who, text }) => ({ who, text }));
      const r = await post<Verdict>(`/api/step/${stepId}/check`, { question, answerKey, answer: text, history });
      const next: Turn[] = [...thread, { who: "learner", text }, { who: "tutor", text: r.feedback, verdict: r.verdict }];
      setThread(next);
      if (r.verdict !== "correct") window.dispatchEvent(new CustomEvent("ct-sound", { detail: "wrong" }));
      if (r.verdict === "correct") onPassed();
      else if (next.filter((t) => t.who === "tutor" && t.verdict && t.verdict !== "correct").length >= MISSES_BEFORE_REEXPLAIN) {
        // Still stuck: the tutor explains it another way, with a new, easier question.
        const re = await post<Reexplain>(`/api/step/${stepId}/reexplain`, {
          wrongAnswers: next.filter((t) => t.who === "learner").map((t) => t.text),
        });
        setAgain(re);
        setThread([{ who: "tutor", text: "Let’s look at it another way. Read “Another way to see it” above, then try this new question." }]);
      }
    } catch (e) {
      setThread((t) => t.slice(0, -1)); // let them send it again
      setError((e as Error).message);
    }
    setBusy(false);
  };
  const solved = thread.some((t) => t.verdict === "correct");
  const missed = thread.some((t) => t.verdict && t.verdict !== "correct");

  return (
    <>
      {again && (
        <div className="info" style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>🔁 Another way to see it</h3>
          {again.explanation.map((p, i) => (
            <p key={i}>
              <InlineMd>{p}</InlineMd>
            </p>
          ))}
          <p className="analogy">
            🧠 <InlineMd>{again.analogy}</InlineMd>
          </p>
          <ReadAloud text={`${again.explanation.join(" ")} ${again.analogy}`} label="Listen" />
        </div>
      )}
      <h3>✋ Your turn</h3>
      <p className="big question">
        <InlineMd>{question}</InlineMd>
      </p>
      <ReadAloud text={question} label="Read question" />
      {alreadyPassed && !solved && <p className="ok">✓ You already got this one. You can move on, or answer again for practice.</p>}

      {thread.length > 0 && (
        <div className="thread" aria-live="polite">
          {thread.map((t, i) =>
            t.who === "learner" ? (
              <div key={i} className="bubble learner">
                <span className="who">You</span>
                {t.text}
              </div>
            ) : (
              <div key={i} className={`bubble tutor ${t.verdict ?? ""}`}>
                <span className="who">
                  {t.verdict === "correct" ? "✓ Right!" : t.verdict === "partly" ? "◐ Almost" : t.verdict === "wrong" ? "✗ Not yet" : "Tutor"}
                </span>
                <InlineMd>{t.text}</InlineMd>
                {t.verdict && t.verdict !== "correct" && (
                  <div>
                    <ReadAloud text={t.text} label="Listen" />
                  </div>
                )}
              </div>
            ),
          )}
          {busy && <div className="bubble tutor">Thinking…</div>}
        </div>
      )}

      {solved ? (
        <p className="ok">
          <b>Well done!</b> You can go to the next part below.
        </p>
      ) : (
        <AnswerBox
          key={again ? "again" : "first"}
          placeholder={thread.length ? "Reply to your tutor, in your own words…" : "Type or speak your answer, in your own words…"}
          submitLabel={thread.length ? "Reply" : "Submit · +20 XP"}
          busy={busy}
          onSubmit={answer}
          clearOnSubmit
        />
      )}
      {error && <p className="error">{error}</p>}
      {missed && !solved && <p className="small muted">This question will also come back in tomorrow’s review, to help it stick.</p>}
    </>
  );
}
