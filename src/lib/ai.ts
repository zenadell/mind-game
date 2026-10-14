import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db, schema } from "@/db";

// Two models: a strong one for teaching, a cheap one for grading short answers.
export const TUTOR_MODEL = process.env.TUTOR_MODEL || "claude-opus-5-5";
export const GRADER_MODEL = process.env.GRADER_MODEL || "claude-haiku-5-5";

// USD per million tokens: [input, output, cache read, cache write (5 min)].
const PRICES: Record<string, [number, number, number, number]> = {
  "claude-opus-5-5": [4, 20, 0.2, 5],
  "claude-sonnet-5-5": [2, 10, 0.2, 2.5],
  "claude-haiku-5-5": [0.1, 0.5, 0.01, 0.125],
};

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY && !FAKE) {
    throw new MissingKeyError();
  }
  client ??= new Anthropic();
  return client;
}

export class MissingKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key.");
  }
}

type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

export function costOf(model: string, u: Usage): number {
  const [inp, out, cr, cw] = PRICES[model] ?? PRICES["claude-opus-5-5"];
  return (
    (u.input_tokens * inp +
      u.output_tokens * out +
      (u.cache_read_input_tokens ?? 0) * cr +
      (u.cache_creation_input_tokens ?? 0) * cw) /
    1_000_000
  );
}

export function recordUsage(purpose: string, model: string, u: Usage) {
  db()
    .insert(schema.apiUsage)
    .values({
      purpose,
      model,
      inputTokens: u.input_tokens,
      outputTokens: u.output_tokens,
      cacheReadTokens: u.cache_read_input_tokens ?? 0,
      cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
      costUsd: costOf(model, u),
      createdAt: Date.now(),
    })
    .run();
}

/** Server-side fallback on a declined request; only the larger models accept it. */
function fallbackParams(model: string) {
  return model.startsWith("claude-opus-5") || model === "claude-sonnet-5-5"
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};
}

function jsonSchema(shape: z.ZodType): Record<string, unknown> {
  const { $schema: _drop, ...schema } = z.toJSONSchema(shape) as Record<string, unknown>;
  return schema;
}

/** Offline mode for trying the app without an API key (CODETUTOR_FAKE_AI=1). Costs nothing. */
const FAKE = process.env.CODETUTOR_FAKE_AI === "1";
function fakeJson(purpose: string, prompt: string): unknown {
  const answer = prompt.match(/(?:Learner answer|Learner teach-back):\s*([\s\S]*)$/)?.[1] ?? "";
  const good = /\b(right|yes|correct|store|because)\b/i.test(answer);
  switch (purpose) {
    case "explain":
    case "re-explain":
      return {
        explanation: `(Offline demo) ${purpose === "re-explain" ? "Another way: " : ""}This step is about the idea in the original text below. Read it, then try the example.`,
        analogy: "Like a labelled box where you keep something.",
        example: 'let message = "Hello";\nconsole.log(message);',
        question: "In your own words, what does this piece teach? (Offline demo: include the word 'because'.)",
        answer_key: "Any answer.",
      };
    case "grade-check":
      return { verdict: good ? "correct" : "wrong", feedback: good ? "Nice." : "(Offline demo) Use the word 'because'." };
    case "grade-teachback":
      return { verdict: good ? "understood" : "partly", feedback: "(Offline demo feedback.)", missing: good ? [] : ["say 'because'"] };
    case "hint":
      return { hint: "(Offline demo hint) What is the first thing your code needs to do?" };
    default:
      return { passed: /\S/.test(prompt.match(/<learner_code>([\s\S]*?)<\/learner_code>/)?.[1] ?? ""), feedback: "(Offline demo grading.)" };
  }
}

/** Ask a model for JSON matching `shape`. Returns the parsed object. */
export async function askJson<T extends z.ZodType>(opts: {
  purpose: string;
  model: string;
  system: string;
  prompt: string;
  shape: T;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<T>> {
  if (FAKE) return opts.shape.parse(fakeJson(opts.purpose, opts.prompt));
  const res = await anthropic().beta.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 4000,
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opts.prompt }],
    output_config: {
      effort: opts.effort ?? "low",
      format: { type: "json_schema", schema: jsonSchema(opts.shape) },
    },
    ...fallbackParams(opts.model),
  });
  recordUsage(opts.purpose, opts.model, res.usage);
  if (res.stop_reason === "refusal") throw new Error("The tutor could not answer that request.");
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return opts.shape.parse(JSON.parse(text));
}

/** Stream a tutor chat reply. Calls onText for each piece, returns the full text. */
export async function streamTutor(opts: {
  system: string;
  lessonContext: string;
  history: { role: "user" | "assistant"; content: string }[];
  onText: (t: string) => void;
}): Promise<string> {
  if (FAKE) {
    const text = "(Offline demo) Good question! What do you think happens first?";
    opts.onText(text);
    return text;
  }
  const stream = anthropic().beta.messages.stream({
    model: TUTOR_MODEL,
    max_tokens: 2000,
    // Rules + lesson text are stable for the whole lesson, so they are cached.
    system: [
      { type: "text", text: opts.system },
      { type: "text", text: opts.lessonContext, cache_control: { type: "ephemeral" } },
    ],
    messages: opts.history,
    output_config: { effort: "low" },
    ...fallbackParams(TUTOR_MODEL),
  });
  let full = "";
  stream.on("text", (t) => {
    full += t;
    opts.onText(t);
  });
  const final = await stream.finalMessage();
  recordUsage("chat", TUTOR_MODEL, final.usage);
  if (final.stop_reason === "refusal" && !full) {
    full = "Sorry, I can't help with that one. Let's get back to the lesson.";
    opts.onText(full);
  }
  return full;
}

/** Remove code blocks so hints and feedback can never hand over a solution. */
export function stripCode(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "(code removed: you write the code yourself)")
    .replace(/`([^`]{40,})`/g, "(code removed)");
}
