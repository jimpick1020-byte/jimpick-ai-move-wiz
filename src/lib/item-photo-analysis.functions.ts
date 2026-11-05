import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
export type PhotoItemCandidate = { name: string; cat: string; features: string; uncertain: boolean };
export const analyzeItemPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ photo: z.string().max(4_000_000).regex(/^data:image\/(png|jpeg);base64,/) }).parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean; candidates?: PhotoItemCandidate[]; error?: string }> => {
    const { analyzePhoto } = await import("./item-photo-analysis.server");
    return analyzePhoto(data.photo);
  });