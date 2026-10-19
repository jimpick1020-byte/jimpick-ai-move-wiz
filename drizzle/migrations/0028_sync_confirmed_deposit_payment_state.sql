CREATE OR REPLACE FUNCTION public.confirm_payment_receipt(_receipt_id uuid, _note text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r public.deposit_records%ROWTYPE; t public.estimate_terms%ROWTYPE; n timestamptz:=now(); received bigint; reviewed_at timestamptz; already boolean;
BEGIN
 IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok',false,'error','로그인이 필요합니다.'); END IF;
 SELECT * INTO r FROM public.deposit_records WHERE id=_receipt_id AND user_id=auth.uid();
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','입금 기록을 찾지 못했습니다.'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || r.estimate_id,0));
 SELECT * INTO t FROM public.estimate_terms WHERE user_id=auth.uid() AND estimate_id=r.estimate_id AND deleted_at IS NULL ORDER BY sheet_version DESC,created_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','견적을 찾지 못했습니다.'); END IF;
 IF t.payment_status IN ('canceled','refunded') OR t.contract_status='cancelled' THEN RETURN jsonb_build_object('ok',false,'error','취소·환불 견적은 확인할 수 없습니다.'); END IF;
 SELECT * INTO r FROM public.deposit_records WHERE id=_receipt_id AND user_id=auth.uid() FOR UPDATE;
 IF r.payment_kind='balance' THEN RETURN public.complete_estimate_payment(r.estimate_id,'bank_transfer',r.id,_note); END IF;
 IF r.payment_kind<>'deposit' OR r.status NOT IN ('pending_review','confirmed') OR r.amount<=0 THEN RETURN jsonb_build_object('ok',false,'error','확인할 예약금 기록이 없습니다.'); END IF;
 IF r.payment_method IS NOT NULL AND r.payment_method<>'bank_transfer' THEN RETURN jsonb_build_object('ok',false,'error','계좌 입금기록만 확인할 수 있습니다.'); END IF;
 already:=r.status='confirmed';
 PERFORM set_config('jimpick.receipt_ack_only','on',true);
 UPDATE public.deposit_records SET status='confirmed',payment_method='bank_transfer',confirmed_at=coalesce(confirmed_at,n),confirmed_by=coalesce(confirmed_by,auth.uid()) WHERE id=r.id AND user_id=auth.uid() RETURNING * INTO r;
 SELECT coalesce(sum(amount),0),max(confirmed_at) INTO received,reviewed_at FROM public.deposit_records WHERE user_id=auth.uid() AND estimate_id=r.estimate_id AND payment_kind='deposit' AND status='confirmed' AND amount>0 AND confirmed_at IS NOT NULL AND confirmed_by IS NOT NULL;
 received:=greatest(received,coalesce(t.deposit_paid,0));
 UPDATE public.estimate_terms SET deposit_paid=received,deposit_paid_at=coalesce(reviewed_at,n),payment_status=CASE WHEN payment_status IN ('completed','partial') THEN payment_status ELSE 'deposit_paid' END,payment_method=CASE WHEN payment_status IN ('completed','partial') THEN payment_method ELSE 'bank_transfer' END,payment_confirmed_at=CASE WHEN payment_status IN ('completed','partial') THEN payment_confirmed_at ELSE coalesce(reviewed_at,n) END,payment_confirmed_by=CASE WHEN payment_status IN ('completed','partial') THEN payment_confirmed_by ELSE auth.uid() END WHERE id=t.id AND user_id=auth.uid();
 PERFORM set_config('jimpick.receipt_ack_only','off',true);
 RETURN jsonb_build_object('ok',true,'already',already,'paid',r.amount,'depositPaid',received,'confirmedAt',r.confirmed_at);
END $$;
REVOKE ALL ON FUNCTION public.confirm_payment_receipt(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_payment_receipt(uuid,text) TO authenticated;
COMMENT ON FUNCTION public.confirm_payment_receipt(uuid,text) IS 'Owner-locked atomic receipt and deposit total acknowledgement; balance delegates to explicit completion; no messaging or total changes.';