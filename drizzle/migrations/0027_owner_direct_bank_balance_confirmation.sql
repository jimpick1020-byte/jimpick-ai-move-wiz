CREATE OR REPLACE FUNCTION public.confirm_owner_bank_balance(_estimate_id text, _expected_amount integer, _owner_reviewed boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE t public.estimate_terms%ROWTYPE; due integer; receipt_id uuid; result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok',false,'error','로그인이 필요합니다.'); END IF;
 IF _owner_reviewed IS DISTINCT FROM true THEN RETURN jsonb_build_object('ok',false,'error','실제 잔금 입금 문자를 먼저 확인해 주세요.'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || _estimate_id,0));
 SELECT * INTO t FROM public.estimate_terms WHERE user_id=auth.uid() AND estimate_id=_estimate_id AND deleted_at IS NULL ORDER BY sheet_version DESC,created_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','견적을 찾지 못했습니다.'); END IF;
 IF t.payment_status IN ('canceled','refunded') OR t.contract_status='cancelled' THEN RETURN jsonb_build_object('ok',false,'error','취소·환불 견적은 완료할 수 없습니다.'); END IF;
 IF t.payment_status='completed' THEN RETURN jsonb_build_object('ok',true,'already',true,'balancePaid',t.balance_paid); END IF;
 due:=greatest(0,coalesce(t.total,0)-coalesce(t.deposit_paid,0)-coalesce(t.balance_paid,0));
 IF due<=0 OR _expected_amount IS NULL OR _expected_amount<>due THEN RETURN jsonb_build_object('ok',false,'error','잔금이 변경되었습니다. 새로고침 후 금액을 확인해 주세요.'); END IF;
 IF EXISTS(SELECT 1 FROM public.deposit_records WHERE user_id=auth.uid() AND estimate_id=_estimate_id AND payment_kind='balance' AND amount>0 AND status='pending_review' AND (payment_method='bank_transfer' OR (payment_method IS NULL AND source IN ('sms_paste','manual')))) THEN RETURN jsonb_build_object('ok',false,'error','기존 잔금 입금 기록을 먼저 확인해 주세요.'); END IF;
 PERFORM set_config('jimpick.receipt_ack_only','on',true);
 INSERT INTO public.deposit_records(user_id,estimate_id,sheet_no,estimate_version,customer_name,depositor_name,amount,source,status,payment_kind,payment_method,confirmed_at,confirmed_by,review_note,dedupe_key)
 VALUES(auth.uid(),_estimate_id,t.sheet_no,coalesce(t.sheet_version,1),coalesce(t.customer_name,''),'',due,'manual','confirmed','balance','bank_transfer',now(),auth.uid(),'업체가 실제 은행 잔금 입금 문자를 직접 확인함. 입금자와 입금 시각은 자동 수집하지 않음.','owner-bank-balance:'||t.id::text||':'||gen_random_uuid()::text)
 RETURNING id INTO receipt_id;
 result:=public.complete_estimate_payment(_estimate_id,'bank_transfer',receipt_id);
 IF coalesce((result->>'ok')::boolean,false) IS DISTINCT FROM true THEN RAISE EXCEPTION '잔금 확인을 저장하지 못했습니다.'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.confirm_owner_bank_balance(text,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_owner_bank_balance(text,integer,boolean) TO authenticated,service_role;