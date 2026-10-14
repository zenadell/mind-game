import { getModelConfig, type ModelConfig, type Protocol, type Role } from "@/lib/models";

export type ModelForm = {
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
  return {
    protocol: f.protocol === "anthropic" ? "anthropic" : "openai",
    baseUrl: (f.baseUrl ?? "").trim().replace(/\/+$/, ""),
    apiKey: f.apiKey?.trim() || saved.apiKey,
    model: (f.model ?? "").trim(),
    priceIn: f.priceIn ?? null,
    priceOut: f.priceOut ?? null,
  };
}
