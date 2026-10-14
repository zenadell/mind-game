import { body, handle } from "@/lib/api";
import { testModel } from "@/lib/ai";
import type { Role } from "@/lib/models";
import { formToConfig, type ModelForm } from "../form";

export const POST = handle(async (req: Request) => {
  const f = await body<ModelForm & { role: Role }>(req);
  const cfg = formToConfig(f.role, f);
  if (!cfg.model) return { ok: false, error: "Pick a model first." };
  return { ok: true, ...(await testModel(cfg)) };
});
