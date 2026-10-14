"use client";

const KEYS = ["A", "B", "C", "D", "E", "F"];

/** Multiple-choice options as big buttons. After answering, shows right and wrong. */
export function Choices({
  options,
  selected,
  right,
  locked,
  onPick,
}: {
  options: string[];
  selected: number | null;
  right?: number | null;
  locked?: boolean;
  onPick: (i: number) => void;
}) {
  return (
    <div className="choices" role="radiogroup">
      {options.map((o, i) => {
        const state =
          locked && right != null ? (i === right ? "right" : i === selected ? "wrong" : "") : i === selected ? "selected" : "";
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={i === selected}
            className={`choice ${state}`}
            disabled={locked}
            onClick={() => onPick(i)}
          >
            <span className="key">{KEYS[i]}</span>
            <code>{o}</code>
            {state === "right" && <span className="small" style={{ marginLeft: "auto" }}>✓ right</span>}
            {state === "wrong" && <span className="small" style={{ marginLeft: "auto" }}>✗ your answer</span>}
          </button>
        );
      })}
    </div>
  );
}

export function CodeSnippet({ code }: { code: string }) {
  if (!code.trim()) return null;
  return (
    <div className="md">
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}
