import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.CODETUTOR_DB = ":memory:";
const M = await import("../src/lib/models");
const { extractJson, costOf } = await import("../src/lib/ai");
const { db, schema } = await import("../src/db");

const ENV = ["TUTOR_PROVIDER", "TUTOR_BASE_URL", "TUTOR_API_KEY", "TUTOR_MODEL", "GRADER_MODEL", "ANTHROPIC_API_KEY", "GRADER_API_KEY"];
beforeEach(() => {
  for (const k of ENV) delete process.env[k];
  db().delete(schema.settings).run();
});

test("env vars configure an OpenAI-compatible tutor; grader reuses it", () => {
  Object.assign(process.env, { TUTOR_BASE_URL: "https://api.deepseek.com/", TUTOR_API_KEY: "sk-1234", TUTOR_MODEL: "deepseek-flash" });
  const t = M.getModelConfig("tutor");
  assert.deepEqual([t.protocol, t.baseUrl, t.model], ["openai", "https://api.deepseek.com", "deepseek-flash"]);
  assert.equal(M.getModelConfig("grader").model, "deepseek-flash");
  process.env.GRADER_MODEL = "deepseek-v4-pro";
  assert.deepEqual([M.getModelConfig("grader").model, M.getModelConfig("grader").apiKey], ["deepseek-v4-pro", "sk-1234"]);
  assert.equal(M.isConfigured(), true);
});

test("saved settings win over env, and the key is never exposed", () => {
  process.env.TUTOR_MODEL = "from-env";
  M.saveModelConfig("tutor", { protocol: "openai", baseUrl: "https://openrouter.ai/api/v1", apiKey: "sk-secret-9876", model: "saved-model" });
  assert.equal(M.getModelConfig("tutor").model, "saved-model");
  const pub = M.publicModelConfig("tutor");
  assert.equal(pub.preset, "openrouter");
  assert.equal(pub.keyHint, "…9876");
  assert.equal(JSON.stringify(pub).includes("secret"), false);
  // An empty key box keeps the saved key.
  assert.equal(M.mergeForSave("tutor", { model: "x" }).apiKey, "sk-secret-9876");
});

test("old ANTHROPIC_API_KEY setups still work", () => {
  process.env.ANTHROPIC_API_KEY = "sk-ant";
  const t = M.getModelConfig("tutor");
  assert.deepEqual([t.protocol, t.model, t.priceIn], ["anthropic", "claude-opus-5-5", 4]);
});

test("not configured without a key, except for local Ollama", () => {
  process.env.TUTOR_MODEL = "m";
  process.env.TUTOR_BASE_URL = "https://api.openai.com/v1";
  assert.equal(M.isConfigured(), false);
  process.env.TUTOR_BASE_URL = "http://localhost:11434/v1";
  assert.equal(M.isConfigured(), true);
});

test("extractJson handles fences and chatter", () => {
  assert.deepEqual(extractJson('Sure!\n```json\n{"a": 1}\n```'), { a: 1 });
  assert.throws(() => extractJson("no json here"));
});

test("cost uses configured prices; unknown prices cost 0", () => {
  assert.equal(costOf({ priceIn: 1, priceOut: 2 }, { input: 1_000_000, output: 1_000_000, cacheRead: 0, cacheWrite: 0 }), 3);
  assert.equal(costOf({ priceIn: null, priceOut: null }, { input: 5, output: 5, cacheRead: 0, cacheWrite: 0 }), 0);
});

test("no address saved: falls back to DeepSeek's address", () => {
  M.saveModelConfig("tutor", { protocol: "openai", baseUrl: "", apiKey: "sk-1", model: "deepseek-flash" });
  const pub = M.publicModelConfig("tutor");
  assert.deepEqual([M.getModelConfig("tutor").baseUrl, pub.preset], ["https://api.deepseek.com", "deepseek"]);
});
