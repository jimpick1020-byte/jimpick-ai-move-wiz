CREATE OR REPLACE FUNCTION public.complete_estimate_payment(_estimate_id text, _method text, _receipt_id uuid DEFAULT NULL::uuid, _note text DEFAULT NULL::text, _approval text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE t public.estimate_terms%ROWTYPE; r public.deposit_records%ROWTYPE; n timestamptz:=now(); received bigint:=0; due integer; complete boolean; newly boolean;
BEGIN
 IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok',false,'error','로그인이 필요합니다.'); END IF;
 IF _method IS NULL OR _method NOT IN ('cash','bank_transfer','card') THEN RETURN jsonb_build_object('ok',false,'error','결제수단을 선택해 주세요.'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || _estimate_id,0));
 SELECT * INTO t FROM public.estimate_terms WHERE user_id=auth.uid() AND estimate_id=_estimate_id AND deleted_at IS NULL ORDER BY sheet_version DESC,created_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','견적을 찾지 못했습니다.'); END IF;
 IF t.payment_status IN ('canceled','refunded') OR t.contract_status='cancelled' THEN RETURN jsonb_build_object('ok',false,'error','취소·환불 견적은 완료할 수 없습니다.'); END IF;
 IF t.payment_status='completed' THEN RETURN jsonb_build_object('ok',true,'already',true,'completed',true,'balancePaid',t.balance_paid); END IF;
 IF t.total<=0 THEN RETURN jsonb_build_object('ok',false,'error','견적 금액이 없어 완료할 수 없습니다.'); END IF;
 due:=greatest(0,t.total-coalesce(t.deposit_paid,0)-coalesce(t.balance_paid,0));
 PERFORM set_config('jimpick.receipt_ack_only','on',true);
 IF _method='bank_transfer' THEN
  SELECT * INTO r FROM public.deposit_records WHERE id=_receipt_id AND user_id=auth.uid() AND estimate_id=_estimate_id FOR UPDATE;
  IF NOT FOUND OR r.amount<=0 OR r.status NOT IN ('pending_review','confirmed') OR r.payment_kind<>'balance' OR (r.payment_method IS NOT NULL AND r.payment_method<>'bank_transfer') THEN
   RETURN jsonb_build_object('ok',false,'error','확인할 잔금 입금기록을 선택해 주세요.');
  END IF;
  -- 이번 입금이 기존 잔금 합계에 아직 포함되지 않았는지 판단합니다 (재클릭 시 중복 합산 방지)
  newly := r.status='pending_review' OR r.confirmed_at IS NULL OR t.balance_paid_at IS NULL OR r.confirmed_at > t.balance_paid_at;
  UPDATE public.deposit_records SET status='confirmed',payment_method='bank_transfer',confirmed_at=coalesce(confirmed_at,n),confirmed_by=coalesce(confirmed_by,auth.uid()) WHERE id=r.id AND user_id=auth.uid();
  SELECT coalesce(sum(amount),0) INTO received FROM public.deposit_records WHERE user_id=auth.uid() AND estimate_id=_estimate_id AND payment_kind='balance' AND payment_method='bank_transfer' AND status='confirmed' AND amount>0 AND confirmed_at IS NOT NULL AND confirmed_by IS NOT NULL;
  received:=greatest(received,coalesce(t.balance_paid,0)+CASE WHEN newly THEN r.amount ELSE 0 END);
  complete:=coalesce(t.deposit_paid,0)+received>=t.total;
 ELSE
  received:=greatest(coalesce(t.balance_paid,0),t.total-coalesce(t.deposit_paid,0)); complete:=true;
 END IF;
 UPDATE public.estimate_terms SET balance_paid=received,balance_paid_at=n,payment_method=_method,payment_amount=CASE WHEN _method='bank_transfer' THEN r.amount ELSE due END,payment_status=CASE WHEN complete THEN 'completed' ELSE 'partial' END,payment_confirmed_at=n,payment_confirmed_by=auth.uid(),paid_at=CASE WHEN complete THEN n ELSE paid_at END,payment_note=coalesce(nullif(trim(_note),''),payment_note),card_approval_number=CASE WHEN _method='card' THEN nullif(trim(_approval),'') ELSE card_approval_number END,calendar_archived=CASE WHEN complete THEN true ELSE calendar_archived END,calendar_archived_at=CASE WHEN complete THEN n ELSE calendar_archived_at END,calendar_archived_by=CASE WHEN complete THEN auth.uid() ELSE calendar_archived_by END,calendar_selected=CASE WHEN complete THEN false ELSE calendar_selected END WHERE id=t.id AND user_id=auth.uid();
 PERFORM set_config('jimpick.receipt_ack_only','off',true);
 RETURN jsonb_build_object('ok',true,'completed',complete,'balancePaid',received,'paid',CASE WHEN _method='bank_transfer' THEN r.amount ELSE due END,'confirmedAt',n,'confirmedBy',auth.uid());
END $function$;

-- 예약금이 확인되면 같은 업체·견적의 고객 요청을 방문 완료로 보존하고 고객 요청 목록에서 숨깁니다 (기록은 삭제하지 않음)
CREATE OR REPLACE FUNCTION public.complete_linked_intake_visit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 IF public.has_confirmed_calendar_deposit(NEW.user_id, NEW.estimate_id) THEN
  UPDATE public.intake_requests
     SET visit_status=CASE WHEN visit_status='scheduled' THEN 'completed' ELSE visit_status END,
         visit_completed_at=CASE WHEN visit_status='scheduled' THEN coalesce(visit_completed_at,now()) ELSE visit_completed_at END,
         deleted_at=coalesce(deleted_at,now())
   WHERE company_id=NEW.user_id AND (estimate_id=NEW.estimate_id OR source_estimate_id=NEW.estimate_id) AND deleted_at IS NULL;
 END IF;
 RETURN NEW;
END $function$;