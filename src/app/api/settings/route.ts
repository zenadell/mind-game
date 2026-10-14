import { body, handle } from "@/lib/api";
import { PRESETS, mergeForSave, publicModelConfig, saveModelConfig, type Role } from "@/lib/models";
import { formToConfig, type ModelForm } from "./form";

export const dynamic = "force-dynamic";

export const GET = handle(async () => ({
  tutor: publicModelConfig("tutor"),
  grader: publicModelConfig("grader"),
  presets: PRESETS,
}));

export const POST = handle(async (req: Request) => {
  const f = await body<ModelForm & { role: Role }>(req);
  const role: Role = f.role === "grader" ? "grader" : "tutor";
  if (role === "grader" && f.sameAsTutor) {
    saveModelConfig("grader", { sameAsTutor: true, model: f.model?.trim() || undefined, priceIn: f.priceIn ?? undefined, priceOut: f.priceOut ?? undefined });
  } else {
    const c = formToConfig(role, f);
    saveModelConfig(role, mergeForSave(role, { ...c, apiKey: f.apiKey?.trim() || undefined, sameAsTutor: false }));
  }
  return { tutor: publicModelConfig("tutor"), grader: publicModelConfig("grader") };
});
