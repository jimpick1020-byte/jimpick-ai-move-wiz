ALTER TABLE public.deposit_records ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.estimate_terms ADD COLUMN IF NOT EXISTS payment_amount integer;
ALTER TABLE public.estimate_terms ADD COLUMN IF NOT EXISTS card_approval_number text;
COMMENT ON COLUMN public.deposit_records.payment_method IS 'Explicit payment method for new receipts; NULL legacy records remain unclassified.';
CREATE OR REPLACE FUNCTION public.complete_estimate_payment(_estimate_id text, _method text, _receipt_id uuid DEFAULT NULL, _note text DEFAULT NULL, _approval text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE t public.estimate_terms%ROWTYPE; r public.deposit_records%ROWTYPE; n timestamptz:=now(); received bigint:=0; due integer; complete boolean;
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
  IF NOT FOUND OR r.amount<=0 OR r.status NOT IN ('pending_review','confirmed') OR r.source='customer_claim' OR r.payment_kind<>'balance' OR (r.payment_method IS NOT NULL AND r.payment_method<>'bank_transfer') THEN
   RETURN jsonb_build_object('ok',false,'error','확인할 실제 잔금 입금기록을 선택해 주세요.');
  END IF;
  UPDATE public.deposit_records SET status='confirmed',payment_method='bank_transfer',confirmed_at=coalesce(confirmed_at,n),confirmed_by=coalesce(confirmed_by,auth.uid()) WHERE id=r.id AND user_id=auth.uid();
  SELECT coalesce(sum(amount),0) INTO received FROM public.deposit_records WHERE user_id=auth.uid() AND estimate_id=_estimate_id AND payment_kind='balance' AND payment_method='bank_transfer' AND status='confirmed' AND amount>0 AND source<>'customer_claim';
  received:=greatest(received,coalesce(t.balance_paid,0));
  complete:=coalesce(t.deposit_paid,0)+received>=t.total;
 ELSE
  received:=greatest(coalesce(t.balance_paid,0),t.total-coalesce(t.deposit_paid,0)); complete:=true;
 END IF;
 UPDATE public.estimate_terms SET balance_paid=received,balance_paid_at=n,payment_method=_method,payment_amount=CASE WHEN _method='bank_transfer' THEN r.amount ELSE due END,payment_status=CASE WHEN complete THEN 'completed' ELSE 'partial' END,payment_confirmed_at=n,payment_confirmed_by=auth.uid(),paid_at=CASE WHEN complete THEN n ELSE paid_at END,payment_note=coalesce(nullif(trim(_note),''),payment_note),card_approval_number=CASE WHEN _method='card' THEN nullif(trim(_approval),'') ELSE card_approval_number END,calendar_archived=CASE WHEN complete THEN true ELSE calendar_archived END,calendar_archived_at=CASE WHEN complete THEN n ELSE calendar_archived_at END,calendar_archived_by=CASE WHEN complete THEN auth.uid() ELSE calendar_archived_by END,calendar_selected=CASE WHEN complete THEN false ELSE calendar_selected END WHERE id=t.id AND user_id=auth.uid();
 PERFORM set_config('jimpick.receipt_ack_only','off',true);
 RETURN jsonb_build_object('ok',true,'completed',complete,'balancePaid',received,'paid',CASE WHEN _method='bank_transfer' THEN r.amount ELSE due END,'confirmedAt',n,'confirmedBy',auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.complete_estimate_payment(text,text,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_estimate_payment(text,text,uuid,text,text) TO authenticated;
COMMENT ON FUNCTION public.complete_estimate_payment(text,text,uuid,text,text) IS 'Owner-scoped explicit cash/bank_transfer/card acknowledgement, no messages, no total or deposit changes. Only sufficient confirmed balance completes.';