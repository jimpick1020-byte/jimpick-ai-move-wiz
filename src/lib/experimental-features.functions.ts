import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ExperimentalFeature = "voice_item_input";

export interface ExperimentalFeatures {
  isSuperAdmin: boolean;
  voiceItemInput: boolean;
}

export const EXPERIMENTS_OFF: ExperimentalFeatures = {
  isSuperAdmin: false,
  voiceItemInput: false,
};

async function readForUser(admin: SupabaseClient, userId: string): Promise<ExperimentalFeatures> {
  const { data: isAdmin, error: roleError } = await admin.rpc("is_super_admin", {
    _user_id: userId,
  });
  if (roleError || isAdmin !== true) return EXPERIMENTS_OFF;

  const { data, error } = await admin
    .from("experimental_feature_settings")
    .select("voice_item_input")
    .eq("setting_key", "global")
    .maybeSingle();
  if (error || !data) return { ...EXPERIMENTS_OFF, isSuperAdmin: true };
  return {
    isSuperAdmin: true,
    voiceItemInput: data.voice_item_input === true,
  };
}

/** 로그인 계정에 실제로 허용된 시험 기능만 돌려줍니다. 일반 계정은 항상 모두 false입니다. */
export const getMyExperimentalFeatures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExperimentalFeatures> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return readForUser(supabaseAdmin, context.userId);
  });

const updateSchema = z.object({
  voiceItemInput: z.boolean(),
});

/** 최고관리자만 전역 시험 기능 값을 바꿀 수 있습니다. */
export const updateExperimentalFeatures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }): Promise<ExperimentalFeatures> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const current = await readForUser(supabaseAdmin, context.userId);
    if (!current.isSuperAdmin) throw new Error("Forbidden: 최고관리자만 변경할 수 있습니다");
    const { error } = await supabaseAdmin.from("experimental_feature_settings").upsert({
      setting_key: "global",
      voice_item_input: data.voiceItemInput,
      updated_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { isSuperAdmin: true, ...data };
  });

/** 서버 기능에서 UI 우회를 다시 검사합니다. */
export async function assertExperimentalFeature(
  userId: string,
  feature: ExperimentalFeature,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const enabled = await readForUser(supabaseAdmin, userId);
  const allowed = enabled.isSuperAdmin && enabled.voiceItemInput;
  if (!allowed) throw new Error("Forbidden: 이 시험 기능은 사용할 수 없습니다");
}
