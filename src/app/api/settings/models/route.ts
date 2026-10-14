import { body, handle } from "@/lib/api";
import { listModels } from "@/lib/ai";
import type { Role } from "@/lib/models";
import { formToConfig, type ModelForm } from "../form";

// Ask the provider which models it has, so new models appear without code changes.
export const POST = handle(async (req: Request) => {
  const f = await body<ModelForm & { role: Role }>(req);
  return { models: await listModels(formToConfig(f.role, f)) };
});
