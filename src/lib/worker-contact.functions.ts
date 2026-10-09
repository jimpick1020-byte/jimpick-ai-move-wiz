import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { WorkerContact } from "./worker-contact";
import { formatTel } from "./format-input";

const schema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  role: z.string().trim().max(60),
  phone: z.string().transform((s) => s.replace(/\D/g, "")).pipe(z.string().regex(/^01[016789][0-9]{7,8}$/)).transform(formatTel),
  photo: z.string().max(1000),
});

export const listWorkerContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkerContact[]> => {
    const { data, error } = await context.supabase.rpc("list_worker_contacts");
    if (error) throw new Error("작업자 목록을 불러오지 못했습니다.");
    // 사용 중지된 작업자는 목록에서 숨깁니다 (기록은 DB에 그대로 남습니다)
    const rows = z.array(schema.extend({ phone: z.string(), legacy: z.boolean().optional(), disabled: z.boolean().optional() }).passthrough()).parse(data ?? []);
    return rows.filter((r) => !r.disabled).map(({ id, name, role, phone, photo, legacy }) => ({ id, name, role, phone: formatTel(phone), photo, legacy }));
  });

export const saveWorkerContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }): Promise<WorkerContact> => {
    const { data: saved, error } = await context.supabase.rpc("save_worker_contact", { _contact: data });
    if (error) throw new Error("작업자 연락처를 저장하지 못했습니다.");
    return schema.extend({ legacy: z.boolean().optional() }).parse(saved);
  });
export const disableWorkerContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { data: ok, error } = await context.supabase.rpc("disable_worker_contact", { _id: data.id });
    if (error || !ok) throw new Error("작업자를 삭제하지 못했습니다.");
    return { ok: true };
  });
