"use client";

import { useEffect, useState } from "react";
import { post } from "@/lib/client";

type Protocol = "anthropic" | "openai";
type Preset = { id: string; label: string; protocol: Protocol; baseUrl: string; keyUrl?: string };
type Saved = {
  preset: string;
  protocol: Protocol;
  baseUrl: string;
  model: string;
  priceIn: number | null;
  priceOut: number | null;
  keyHint: string;
  sameAsTutor?: boolean;
};
type Role = "tutor" | "grader";

export function SettingsForm() {
  const [data, setData] = useState<{ tutor: Saved; grader: Saved; presets: Preset[] } | null>(null);
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setData);
  }, []);
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <>
      <ModelSection
        role="tutor"
        title="Tutor model"
        about="Explains each step, gives hints and chats with you. Pick a good model."
        saved={data.tutor}
        presets={data.presets}
        onSaved={(s) => setData({ ...data, ...s })}
      />
      <ModelSection
        role="grader"
        title="Grader model"
        about="Marks your short answers. A cheaper, faster model is fine here."
        saved={data.grader}
        presets={data.presets}
        onSaved={(s) => setData({ ...data, ...s })}
      />
      <p className="muted small">
        Your API keys are saved only on this computer (in the <code>data/</code> folder) and are never shown again in the
        browser.
      </p>
    </>
  );
}

function ModelSection({
  role,
  title,
  about,
  saved,
  presets,
  onSaved,
}: {
  role: Role;
  title: string;
  about: string;
  saved: Saved;
  presets: Preset[];
  onSaved: (s: { tutor: Saved; grader: Saved }) => void;
}) {
  const [preset, setPreset] = useState(saved.preset);
  const [protocol, setProtocol] = useState<Protocol>(saved.protocol);
  const [baseUrl, setBaseUrl] = useState(saved.baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(saved.model);
  const [priceIn, setPriceIn] = useState(saved.priceIn?.toString() ?? "");
  const [priceOut, setPriceOut] = useState(saved.priceOut?.toString() ?? "");
  const [same, setSame] = useState(!!saved.sameAsTutor);
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error" | "warn"; text: string } | null>(null);

  const p = presets.find((x) => x.id === preset);
  const form = () => ({
    role,
    preset,
    protocol,
    baseUrl,
    apiKey,
    model,
    priceIn: priceIn === "" ? null : Number(priceIn),
    priceOut: priceOut === "" ? null : Number(priceOut),
    sameAsTutor: role === "grader" ? same : undefined,
  });

  const choosePreset = (id: string) => {
    setPreset(id);
    const x = presets.find((y) => y.id === id);
    if (x) {
      setProtocol(x.protocol);
      if (x.baseUrl || id === "custom") setBaseUrl(x.baseUrl);
    }
    setModels([]);
    setModel("");
  };

  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
    setBusy(null);
  };

  const loadModels = () =>
    run("models", async () => {
      const r = await post<{ models: string[] }>("/api/settings/models", form());
      setModels(r.models);
      setMsg({ kind: "ok", text: `Found ${r.models.length} model${r.models.length === 1 ? "" : "s"}. Pick one below.` });
      if (!model && r.models[0]) setModel(r.models[0]);
    });

  const test = () =>
    run("test", async () => {
      const r = await post<{ ok: boolean; reply?: string; ms?: number; error?: string }>("/api/settings/test", form());
      setMsg(r.ok ? { kind: "ok", text: `✔ It works! The model replied "${r.reply}" in ${((r.ms ?? 0) / 1000).toFixed(1)}s.` } : { kind: "error", text: r.error ?? "Failed." });
    });

  const save = () =>
    run("save", async () => {
      const r = await post<{ tutor: Saved; grader: Saved }>("/api/settings", form());
      onSaved(r);
      setApiKey("");
      setMsg({ kind: "ok", text: "Saved." });
    });

  const own = !(role === "grader" && same);

  return (
    <section className="card settings">
      <h2>{title}</h2>
      <p className="muted">{about}</p>

      {role === "grader" && (
        <label className="check">
          <input type="checkbox" checked={same} onChange={(e) => setSame(e.target.checked)} /> Use the same provider and key as
          the tutor
        </label>
      )}

      {own && (
        <>
          <label>
            Provider
            <select value={preset} onChange={(e) => choosePreset(e.target.value)}>
              {presets.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          {(preset === "custom" || preset === "ollama") && (
            <>
              <label>
                API address (base URL)
                <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" />
              </label>
              <label>
                API style
                <select value={protocol} onChange={(e) => setProtocol(e.target.value as Protocol)}>
                  <option value="openai">OpenAI-compatible (most providers)</option>
                  <option value="anthropic">Anthropic Messages</option>
                </select>
              </label>
            </>
          )}
          {preset !== "ollama" && (
            <label>
              API key {p?.keyUrl && (
                <a href={p.keyUrl} target="_blank" rel="noreferrer" className="small">
                  (get one)
                </a>
              )}
              <input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={saved.keyHint && saved.preset === preset ? `Saved key ${saved.keyHint} (leave empty to keep it)` : "Paste your API key"}
              />
            </label>
          )}
        </>
      )}

      <label>
        Model {role === "grader" && same && <span className="muted small">(empty = same model as the tutor)</span>}
        <div className="row tight">
          <input list={`models-${role}`} value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. deepseek-flash" />
          <button type="button" className="btn secondary" onClick={loadModels} disabled={!!busy}>
            {busy === "models" ? "Loading…" : "Load models"}
          </button>
        </div>
        <datalist id={`models-${role}`}>
          {models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>
      {models.length > 0 && (
        <div className="chips">
          {models.map((m) => (
            <button type="button" key={m} className={`chip ${m === model ? "on" : ""}`} onClick={() => setModel(m)}>
              {m}
            </button>
          ))}
        </div>
      )}

      <details>
        <summary>Prices (optional, for the cost counter)</summary>
        <p className="muted small">US dollars per 1 million tokens. Check your provider’s pricing page. Leave empty if you don’t know.</p>
        <div className="row tight">
          <label>
            Input
            <input inputMode="decimal" value={priceIn} onChange={(e) => setPriceIn(e.target.value)} placeholder="0.00" />
          </label>
          <label>
            Output
            <input inputMode="decimal" value={priceOut} onChange={(e) => setPriceOut(e.target.value)} placeholder="0.00" />
          </label>
        </div>
      </details>

      <div className="row">
        <button type="button" className="btn" onClick={save} disabled={!!busy}>
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn secondary" onClick={test} disabled={!!busy}>
          {busy === "test" ? "Testing…" : "Test"}
        </button>
      </div>
      {msg && <p className={msg.kind}>{msg.text}</p>}
    </section>
  );
}
