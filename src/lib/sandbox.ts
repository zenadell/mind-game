"use client";

export type LogLine = { type: "log" | "warn" | "error" | "alert" | "prompt"; text: string };
export type TestResult = { name: string; passed: boolean; error?: string };
export type RunResult = { logs: LogLine[]; error: string | null; results: TestResult[] | null; timedOut?: boolean };

const TIME_LIMIT_MS = 3000;

/** Run code (and optional mocha-style tests) in a throwaway Web Worker with a time limit. */
export function runCode(code: string, opts: { tests?: string | null; inputs?: string[] } = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL("./sandbox-worker.js", import.meta.url));
    const timer = setTimeout(() => {
      worker.terminate();
      resolve({
        logs: [],
        error: `Your code ran for more than ${TIME_LIMIT_MS / 1000} seconds, so it was stopped. Is there a loop that never ends?`,
        results: null,
        timedOut: true,
      });
    }, TIME_LIMIT_MS);
    worker.onmessage = (e: MessageEvent<RunResult>) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ logs: [], error: e.message || "Your code could not run.", results: null });
    };
    worker.postMessage({ code, tests: opts.tests ?? null, inputs: opts.inputs ?? [] });
  });
}

/** Plain-text summary of a run, used when grading. */
export function outputText(r: RunResult): string {
  const lines = r.logs.map((l) => (l.type === "log" ? l.text : `[${l.type}] ${l.text}`));
  if (r.error) lines.push(`[error] ${r.error}`);
  return lines.join("\n");
}
