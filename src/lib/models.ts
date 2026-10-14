import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

// Which AI model does what. Any provider works: Anthropic's own API, or any
// "OpenAI-compatible" API (DeepSeek, OpenAI, OpenRouter, Groq, Gemini, Ollama...).
// Settings saved in the app win over environment variables.

export type Role = "tutor" | "grader";
export type Protocol = "anthropic" | "openai";

export type ModelConfig = {
  protocol: Protocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** USD per million tokens, for the cost counter. Blank = unknown (shown as $0). */
  priceIn: number | null;
  priceOut: number | null;
};

/** Ready-made provider settings. The model list is fetched live from the provider. */
export const PRESETS: { id: string; label: string; protocol: Protocol; baseUrl: string; keyUrl?: string }[] = [
  { id: "deepseek", label: "DeepSeek", protocol: "openai", baseUrl: "https://api.deepseek.com", keyUrl: "https://platform.deepseek.com/api_keys" },
  { id: "anthropic", label: "Anthropic (Claude)", protocol: "anthropic", baseUrl: "https://api.anthropic.com", keyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "openai", label: "OpenAI", protocol: "openai", baseUrl: "https://api.openai.com/v1", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "openrouter", label: "OpenRouter (many models)", protocol: "openai", baseUrl: "https://openrouter.ai/api/v1", keyUrl: "https://openrouter.ai/keys" },
  { id: "gemini", label: "Google Gemini", protocol: "openai", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", keyUrl: "https://aistudio.google.com/apikey" },
  { id: "groq", label: "Groq", protocol: "openai", baseUrl: "https://api.groq.com/openai/v1", keyUrl: "https://console.groq.com/keys" },
  { id: "ollama", label: "Ollama (on this computer, free)", protocol: "openai", baseUrl: "http://localhost:11434/v1" },
  { id: "custom", label: "Other (OpenAI-compatible)", protocol: "openai", baseUrl: "" },
];

// Known prices (USD per million tokens), used when no price is set.
const KNOWN_PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};

type Stored = Partial<ModelConfig> & { sameAsTutor?: boolean };

function readStored(role: Role): Stored {
  const row = db().select().from(schema.settings).where(eq(schema.settings.key, `model.${role}`)).get();
  if (!row) return {};
  try {
    return JSON.parse(row.value) as Stored;
  } catch {
    return {};
  }
}

function num(v: string | undefined): number | null {
  return v && !Number.isNaN(Number(v)) ? Number(v) : null;
}

function fromEnv(role: Role): Partial<ModelConfig> {
  const P = role.toUpperCase();
  const e = process.env;
  const out: Partial<ModelConfig> = {};
  if (e[`${P}_PROVIDER`]) out.protocol = e[`${P}_PROVIDER`] === "anthropic" ? "anthropic" : "openai";
  if (e[`${P}_BASE_URL`]) out.baseUrl = e[`${P}_BASE_URL`];
  if (e[`${P}_API_KEY`]) out.apiKey = e[`${P}_API_KEY`];
  if (e[`${P}_MODEL`]) out.model = e[`${P}_MODEL`];
  if (num(e[`${P}_PRICE_IN`]) !== null) out.priceIn = num(e[`${P}_PRICE_IN`]);
  if (num(e[`${P}_PRICE_OUT`]) !== null) out.priceOut = num(e[`${P}_PRICE_OUT`]);
  return out;
}

function clean<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as Partial<T>;
}

/** The model settings for a role, merged from: saved settings > env vars > defaults. */
export function getModelConfig(role: Role): ModelConfig {
  const stored = readStored(role);
  if (role === "grader" && (stored.sameAsTutor ?? !hasOwnGrader())) {
    const t = getModelConfig("tutor");
    return {
      ...t,
      ...clean({ model: stored.model ?? process.env.GRADER_MODEL, priceIn: stored.priceIn ?? undefined, priceOut: stored.priceOut ?? undefined }),
    } as ModelConfig;
  }
  const { sameAsTutor: _s, ...saved } = stored;
  const merged: Partial<ModelConfig> = { ...clean(fromEnv(role)), ...clean(saved) };

  // Old setups with only ANTHROPIC_API_KEY keep working.
  if (!merged.apiKey && !merged.protocol && process.env.ANTHROPIC_API_KEY) {
    merged.protocol = "anthropic";
    merged.apiKey = process.env.ANTHROPIC_API_KEY;
  }
  const protocol = merged.protocol ?? "openai";
  const model =
    merged.model ??
    (protocol === "anthropic" ? (role === "tutor" ? "claude-opus-5-5" : "claude-haiku-5-5") : "");
  const known = KNOWN_PRICES[model];
  return {
    protocol,
    baseUrl: (merged.baseUrl ?? (protocol === "anthropic" ? "https://api.anthropic.com" : "")).replace(/\/+$/, ""),
    apiKey: merged.apiKey ?? "",
    model,
    priceIn: merged.priceIn ?? known?.[0] ?? null,
    priceOut: merged.priceOut ?? known?.[1] ?? null,
  };
}

function hasOwnGrader(): boolean {
  const e = process.env;
  return !!(e.GRADER_PROVIDER || e.GRADER_BASE_URL || e.GRADER_API_KEY);
}

/** True when the tutor can actually call a model. */
export function isConfigured(): boolean {
  if (process.env.CODETUTOR_FAKE_AI === "1") return true;
  const c = getModelConfig("tutor");
  const needsKey = !/localhost|127\.0\.0\.1/.test(c.baseUrl);
  return !!c.model && !!c.baseUrl && (!needsKey || !!c.apiKey);
}

export function saveModelConfig(role: Role, value: Stored) {
  const row = { key: `model.${role}`, value: JSON.stringify(value) };
  db().insert(schema.settings).values(row).onConflictDoUpdate({ target: schema.settings.key, set: row }).run();
}

/** What the settings page may see. The API key never goes back to the browser. */
export function publicModelConfig(role: Role) {
  const c = getModelConfig(role);
  const stored = readStored(role);
  const preset =
    PRESETS.find((p) => p.protocol === c.protocol && p.baseUrl && p.baseUrl === c.baseUrl)?.id ?? (c.baseUrl ? "custom" : "deepseek");
  return {
    preset,
    protocol: c.protocol,
    baseUrl: c.baseUrl,
    model: c.model,
    priceIn: c.priceIn,
    priceOut: c.priceOut,
    keyHint: c.apiKey ? `…${c.apiKey.slice(-4)}` : "",
    sameAsTutor: role === "grader" ? (stored.sameAsTutor ?? !hasOwnGrader()) : undefined,
  };
}

/** Keep the saved key when the form leaves the key box empty. */
export function mergeForSave(role: Role, incoming: Stored): Stored {
  const old = readStored(role);
  return { ...incoming, apiKey: incoming.apiKey || old.apiKey || undefined };
}
