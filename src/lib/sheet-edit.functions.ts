import { createServerFn } from '@tanstack/react-start';
import { requireActiveEntitlement } from './entitlement.functions';
import { z } from 'zod';
import { sheetRoomsOf } from './sheet-edit';
import { formatDraftPhones } from './format-input';
import type { Estimate } from './jimpick';

/** Only explicit owner saves change the current shared sheet; consent/payment audit is untouched. */
export const syncEditedSheet = createServerFn({ method: 'POST' })
  .middleware([requireActiveEntitlement])
  .inputValidator((input: unknown) => z.object({ estimateId: z.string().min(1).max(80), revision: z.number().int().positive() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { data: stored, error: draftError } = await context.supabase.from('estimate_drafts')
      .select('payload, revision').eq('user_id', context.userId).eq('estimate_id', data.estimateId).is('deleted_at', null).maybeSingle();
    if (draftError || !stored || Number(stored.revision) !== data.revision) return { ok: false, error: '저장된 편집본이 변경되었습니다. 다시 저장해 주세요.' };
    const draft = formatDraftPhones(stored.payload as unknown as Estimate);
    if (draft.id !== data.estimateId || !Array.isArray(draft.rooms) || !draft.sheetSnapshot) return { ok: false, error: '편집본을 읽지 못했습니다.' };
    const { data: row, error: readError } = await context.supabase.from('estimate_terms')
      .select('id, sheet_version, move_date').eq('user_id', context.userId).eq('estimate_id', data.estimateId)
      .is('deleted_at', null).is('cancelled_at', null).order('sheet_version', { ascending: false }).limit(1).maybeSingle();
    if (readError) return { ok: false, error: '고객 견적서를 읽지 못했습니다. 편집본은 보존되었습니다.' };
    if (!row) return { ok: true };
    const { error } = await context.supabase.from('estimate_terms').update({
      customer_name: draft.customerName, contact_phone: draft.phone, move_date: draft.moveDate || null,
      company_phone: draft.staffPhone || null, total: draft.total,
      sheet_snapshot: JSON.stringify({ draft, rooms: sheetRoomsOf(draft), parts: draft.sheetSnapshot.parts, total: draft.total }),
    }).eq('id', row.id).eq('user_id', context.userId);
    if (error) return { ok: false, error: '편집본은 저장했지만 고객 견적서 반영에 실패했습니다. 다시 저장해 주세요.' };
    try {
      const { syncMoveReminder } = await import('./reminder.server');
      await syncMoveReminder(row.id);
    } catch { return { ok: false, error: '견적서는 저장했지만 전날 안내 일정 갱신을 확인하지 못했습니다. 다시 저장해 주세요.' }; }
    return { ok: true };
  });