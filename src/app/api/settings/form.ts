import { PRESETS, getModelConfig, type ModelConfig, type Protocol, type Role } from "@/lib/models";

export type ModelForm = {
  preset?: string;
  protocol: Protocol;
  baseUrl: string;
  apiKey?: string;
  model?: string;
  priceIn?: number | null;
  priceOut?: number | null;
  sameAsTutor?: boolean;
};

/** Settings from the form; an empty key box means "keep the saved key". */
export function formToConfig(role: Role, f: ModelForm): ModelConfig {
  const saved = getModelConfig(role === "grader" && f.sameAsTutor ? "tutor" : role);
  if (role === "grader" && f.sameAsTutor) return { ...saved, model: f.model?.trim() || saved.model };
  // A named provider always uses its own address; only "Other" and Ollama take a typed one.
  const preset = PRESETS.find((p) => p.id === f.preset && p.id !== "custom");
  const typed = (f.baseUrl ?? "").trim().replace(/\/+$/, "");
  return {
    protocol: preset?.protocol ?? (f.protocol === "anthropic" ? "anthropic" : "openai"),
    baseUrl: preset && preset.id !== "ollama" ? preset.baseUrl : typed || preset?.baseUrl || "",
    apiKey: f.apiKey?.trim() || saved.apiKey,
    model: (f.model ?? "").trim(),
    priceIn: f.priceIn ?? null,
    priceOut: f.priceOut ?? null,
  };
}
