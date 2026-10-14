import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db, schema } from "@/db";
import { getModelConfig, isConfigured, type ModelConfig, type Role } from "./models";

// Talks to whichever model is set up in Settings: Anthropic's API, or any
// OpenAI-compatible API (DeepSeek, OpenAI, OpenRouter, Gemini, Groq, Ollama...).

export class MissingKeyError extends Error {
  constructor() {
    super("No AI model is set up yet. Open ⚙️ Settings and add your API key and model.");
  }
}

/** A friendly error from the model provider (bad key, rate limit, wrong model name...). */
export class ProviderError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// ---------- Cost tracking ----------

type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number };

/** USD. Cache reads are billed at about 10% of input, cache writes about 125%. */
export function costOf(cfg: Pick<ModelConfig, "priceIn" | "priceOut">, u: Usage): number {
  const inp = cfg.priceIn ?? 0;
  const out = cfg.priceOut ?? 0;
  return (u.input * inp + u.cacheRead * inp * 0.1 + u.cacheWrite * inp * 1.25 + u.output * out) / 1_000_000;
}

function recordUsage(purpose: string, cfg: ModelConfig, u: Usage) {
  db()
    .insert(schema.apiUsage)
    .values({
      purpose,
      model: cfg.model,
      inputTokens: u.input,
      outputTokens: u.output,
      cacheReadTokens: u.cacheRead,
      cacheWriteTokens: u.cacheWrite,
      costUsd: costOf(cfg, u),
      createdAt: Date.now(),
    })
    .run();
}

function fromAnthropicUsage(u: Anthropic.Beta.BetaUsage): Usage {
  return {
    input: u.input_tokens,
    output: u.output_tokens,
    cacheRead: u.cache_read_input_tokens ?? 0,
    cacheWrite: u.cache_creation_input_tokens ?? 0,
  };
}

type OpenAIUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  prompt_cache_hit_tokens?: number;
};

function fromOpenAIUsage(u: OpenAIUsage | undefined): Usage {
  const cached = u?.prompt_tokens_details?.cached_tokens ?? u?.prompt_cache_hit_tokens ?? 0;
  return { input: (u?.prompt_tokens ?? 0) - cached, output: u?.completion_tokens ?? 0, cacheRead: cached, cacheWrite: 0 };
}

// ---------- Config ----------

const FAKE = process.env.CODETUTOR_FAKE_AI === "1";

function configFor(role: Role): ModelConfig {
  if (!isConfigured()) throw new MissingKeyError();
  return getModelConfig(role);
}

const isClaude = (model: string) => model.startsWith("claude-");

function anthropicClient(cfg: ModelConfig): Anthropic {
  return new Anthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl || undefined });
}

/** Server-side fallback on a declined request; only the larger Claude models accept it. */
function fallbackParams(model: string) {
  return model.startsWith("claude-opus-5") || model === "claude-sonnet-5-5"
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};
}

/** Claude 5 models take an effort level; other models get no extra parameters. */
function claudeEffort(model: string) {
  return isClaude(model) ? { effort: "low" as const } : {};
}

function anthropicError(e: unknown): never {
  if (e instanceof Anthropic.AuthenticationError) throw new ProviderError("The API key was rejected. Check it in ⚙️ Settings.", 401);
  if (e instanceof Anthropic.RateLimitError) throw new ProviderError("The tutor is busy. Wait a minute and try again.", 429);
  if (e instanceof Anthropic.NotFoundError) throw new ProviderError("That model name wasn't found. Check it in ⚙️ Settings.", 404);
  if (e instanceof Anthropic.APIConnectionError) throw new ProviderError("Can't reach the AI provider. Check your internet connection.", 503);
  if (e instanceof Anthropic.APIError) throw new ProviderError(`The AI provider said: ${e.message}`, e.status ?? 500);
  throw e;
}

// ---------- OpenAI-compatible HTTP ----------

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function openaiFetch(cfg: ModelConfig, path: string, body?: object): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ProviderError(`Can't reach ${cfg.baseUrl}. Check the address and your internet connection.`, 503);
  }
  if (res.ok) return res;
  const text = await res.text().catch(() => "");
  let detail = text.slice(0, 300);
  try {
    detail = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? detail;
  } catch {}
  if (res.status === 401 || res.status === 403)
    throw new ProviderError("The API key was rejected. Check it in ⚙️ Settings.", res.status);
  if (res.status === 429) throw new ProviderError("The tutor is busy (or out of credit). Wait a minute and try again.", 429);
  if (res.status === 402) throw new ProviderError("Your AI account is out of credit. Top it up with the provider.", 402);
  throw new ProviderError(`The AI provider said: ${detail || res.statusText}`, res.status);
}

async function openaiChat(cfg: ModelConfig, messages: ChatMessage[], extra: object = {}) {
  const res = await openaiFetch(cfg, "/chat/completions", { model: cfg.model, messages, ...extra });
  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[]; usage?: OpenAIUsage };
  return { text: data.choices?.[0]?.message?.content ?? "", usage: fromOpenAIUsage(data.usage) };
}

// ---------- JSON answers ----------

function jsonSchema(shape: z.ZodType): Record<string, unknown> {
  const { $schema: _drop, ...rest } = z.toJSONSchema(shape) as Record<string, unknown>;
  return rest;
}

/** Pull a JSON object out of a reply, even if wrapped in ```json fences or chatter. */
export function extractJson(text: string): unknown {
  const t = text.replace(/```(?:json)?/gi, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) throw new SyntaxError("no JSON object found");
  return JSON.parse(t.slice(start, end + 1));
}

/** Offline mode for trying the app without an API key (CODETUTOR_FAKE_AI=1). Costs nothing. */
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

/** Ask the tutor or grader model for JSON matching `shape`. Returns the parsed object. */
export async function askJson<T extends z.ZodType>(opts: {
  purpose: string;
  role: Role;
  system: string;
  prompt: string;
  shape: T;
  maxTokens?: number;
}): Promise<z.infer<T>> {
  if (FAKE) return opts.shape.parse(fakeJson(opts.purpose, opts.prompt));
  const cfg = configFor(opts.role);
  const schemaJson = jsonSchema(opts.shape);

  // Claude: the API guarantees the JSON shape.
  if (cfg.protocol === "anthropic" && isClaude(cfg.model)) {
    const res = await anthropicClient(cfg)
      .beta.messages.create({
        model: cfg.model,
        max_tokens: opts.maxTokens ?? 4000,
        system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: opts.prompt }],
        output_config: { ...claudeEffort(cfg.model), format: { type: "json_schema", schema: schemaJson } },
        ...fallbackParams(cfg.model),
      })
      .catch(anthropicError);
    recordUsage(opts.purpose, cfg, fromAnthropicUsage(res.usage));
    if (res.stop_reason === "refusal") throw new ProviderError("The tutor could not answer that request.", 400);
    return opts.shape.parse(JSON.parse(res.content.map((b) => (b.type === "text" ? b.text : "")).join("")));
  }

  // Everyone else: describe the JSON in the prompt, check it, and ask once more if it's wrong.
  const system = `${opts.system}\n\nReply with ONLY a JSON object (no other text) that matches this JSON Schema:\n${JSON.stringify(schemaJson)}`;
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: opts.prompt },
  ];
  // Reasoning models spend tokens thinking before they answer, so leave room.
  const maxTokens = Math.max(opts.maxTokens ?? 0, 8000);
  let jsonMode = true;
  for (let attempt = 0; attempt < 2; attempt++) {
    let text: string;
    if (cfg.protocol === "anthropic") {
      const res = await anthropicClient(cfg)
        .messages.create({
          model: cfg.model,
          max_tokens: maxTokens,
          system,
          messages: messages.slice(1).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        })
        .catch(anthropicError);
      recordUsage(opts.purpose, cfg, fromAnthropicUsage(res.usage as Anthropic.Beta.BetaUsage));
      text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    } else {
      let r;
      try {
        r = await openaiChat(cfg, messages, { max_tokens: maxTokens, ...(jsonMode ? { response_format: { type: "json_object" } } : {}) });
      } catch (e) {
        // Some providers don't support JSON mode; try again without it.
        if (jsonMode && e instanceof ProviderError && e.status === 400) {
          jsonMode = false;
          attempt--;
          continue;
        }
        throw e;
      }
      recordUsage(opts.purpose, cfg, r.usage);
      text = r.text;
    }
    let problem: string;
    try {
      const parsed = opts.shape.safeParse(extractJson(text));
      if (parsed.success) return parsed.data;
      problem = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch (e) {
      problem = (e as Error).message;
    }
    messages.push(
      { role: "assistant", content: text },
      { role: "user", content: `That reply was not valid (${problem}). Reply again with ONLY the corrected JSON object.` },
    );
  }
  throw new ProviderError("The model's answer was not in the expected format. Try again, or pick a different model in ⚙️ Settings.", 502);
}

// ---------- Tutor chat (streamed) ----------

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
  const cfg = configFor("tutor");
  let full = "";
  const emit = (t: string) => {
    full += t;
    opts.onText(t);
  };

  if (cfg.protocol === "anthropic") {
    const stream = anthropicClient(cfg).beta.messages.stream({
      model: cfg.model,
      max_tokens: isClaude(cfg.model) ? 2000 : 8000,
      // Rules + lesson text are stable for the whole lesson, so they are cached.
      system: [
        { type: "text", text: opts.system },
        { type: "text", text: opts.lessonContext, cache_control: { type: "ephemeral" } },
      ],
      messages: opts.history,
      ...(isClaude(cfg.model) ? { output_config: claudeEffort(cfg.model) } : {}),
      ...fallbackParams(cfg.model),
    });
    stream.on("text", emit);
    const final = await stream.finalMessage().catch(anthropicError);
    recordUsage("chat", cfg, fromAnthropicUsage(final.usage));
    if (final.stop_reason === "refusal" && !full) emit("Sorry, I can't help with that one. Let's get back to the lesson.");
    return full;
  }

  // OpenAI-compatible streaming (server-sent events). The stable system text comes
  // first, so providers with automatic prompt caching (e.g. DeepSeek) can reuse it.
  const res = await openaiFetch(cfg, "/chat/completions", {
    model: cfg.model,
    messages: [{ role: "system", content: `${opts.system}\n\n${opts.lessonContext}` }, ...opts.history],
    max_tokens: 8000,
    stream: true,
    stream_options: { include_usage: true },
  });
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let usage: OpenAIUsage | undefined;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const data = line.replace(/^data:\s*/, "").trim();
      if (!line.startsWith("data:") || !data || data === "[DONE]") continue;
      try {
        const chunk = JSON.parse(data) as { choices?: { delta?: { content?: string | null } }[]; usage?: OpenAIUsage };
        const piece = chunk.choices?.[0]?.delta?.content;
        if (piece) emit(piece);
        if (chunk.usage) usage = chunk.usage;
      } catch {}
    }
  }
  recordUsage("chat", cfg, fromOpenAIUsage(usage));
  return full;
}

// ---------- Settings helpers ----------

/** List the model names a provider offers (so new models show up without code changes). */
export async function listModels(cfg: ModelConfig): Promise<string[]> {
  if (cfg.protocol === "anthropic") {
    const ids: string[] = [];
    try {
      for await (const m of anthropicClient(cfg).models.list()) ids.push(m.id);
    } catch (e) {
      anthropicError(e);
    }
    return ids;
  }
  const res = await openaiFetch(cfg, "/models");
  const data = (await res.json()) as { data?: { id: string }[]; models?: { name: string }[] };
  return (data.data?.map((m) => m.id) ?? data.models?.map((m) => m.name) ?? []).sort();
}

/** Send a tiny request to check the key and model work. */
export async function testModel(cfg: ModelConfig): Promise<{ reply: string; ms: number }> {
  const t = Date.now();
  const prompt = "Reply with just the word: ready";
  let reply: string;
  if (cfg.protocol === "anthropic") {
    const res = await anthropicClient(cfg)
      .messages.create({ model: cfg.model, max_tokens: isClaude(cfg.model) ? 200 : 2000, messages: [{ role: "user", content: prompt }] })
      .catch(anthropicError);
    reply = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  } else {
    reply = (await openaiChat(cfg, [{ role: "user", content: prompt }], { max_tokens: 2000 })).text;
  }
  return { reply: reply.trim().slice(0, 100), ms: Date.now() - t };
}

/** Remove code blocks so hints and feedback can never hand over a solution. */
export function stripCode(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "(code removed: you write the code yourself)")
    .replace(/`([^`]{40,})`/g, "(code removed)");
}
