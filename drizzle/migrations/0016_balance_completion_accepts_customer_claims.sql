CREATE OR REPLACE FUNCTION public.complete_receipted_estimate(_estimate_id text, _note text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE t public.estimate_terms%ROWTYPE; received bigint; n timestamptz:=now();
BEGIN
 IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok',false,'error','로그인이 필요합니다.'); END IF;
 SELECT * INTO t FROM public.estimate_terms WHERE user_id=auth.uid() AND estimate_id=_estimate_id AND deleted_at IS NULL ORDER BY sheet_version DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','견적을 찾지 못했습니다.'); END IF;
 IF t.payment_status IN ('canceled','refunded') THEN RETURN jsonb_build_object('ok',false,'error','취소·환불 견적은 완료할 수 없습니다.'); END IF;
 PERFORM id FROM public.deposit_records WHERE user_id=auth.uid() AND estimate_id=_estimate_id FOR UPDATE;
 SELECT coalesce(sum(amount),0) INTO received FROM public.deposit_records WHERE user_id=auth.uid() AND estimate_id=_estimate_id AND payment_kind='balance' AND source IN ('sms_paste','manual','customer_claim') AND status IN ('confirmed','pending_review') AND amount>0;
 IF t.total<=0 OR received<=0 OR coalesce(t.deposit_paid,0)+received<t.total THEN RETURN jsonb_build_object('ok',false,'error','실제 잔금 입금기록이 부족합니다.'); END IF;
 UPDATE public.deposit_records SET status='confirmed',confirmed_at=coalesce(confirmed_at,n),confirmed_by=coalesce(confirmed_by,auth.uid()) WHERE user_id=auth.uid() AND estimate_id=_estimate_id AND payment_kind='balance' AND source IN ('sms_paste','manual','customer_claim') AND status='pending_review' AND amount>0;
 UPDATE public.estimate_terms SET balance_paid=received,balance_paid_at=n,payment_status='completed',payment_confirmed_at=n,payment_confirmed_by=auth.uid(),paid_at=n,payment_note=_note,calendar_archived=true,calendar_archived_at=n,calendar_archived_by=auth.uid(),calendar_selected=false WHERE id=t.id AND user_id=auth.uid();
 RETURN jsonb_build_object('ok',true,'balancePaid',received,'confirmedAt',n);
END $function$;