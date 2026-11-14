ALTER TABLE public.deposit_records ADD COLUMN IF NOT EXISTS linked_evidence_key text;
COMMENT ON COLUMN public.deposit_records.linked_evidence_key IS 'Bank evidence dedupe key linked 1:1 to a customer claim receipt';
CREATE UNIQUE INDEX IF NOT EXISTS deposit_records_linked_evidence_idx ON public.deposit_records (user_id, linked_evidence_key) WHERE linked_evidence_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_bank_receipt(p_company uuid, p_estimate text, p_kind text, p_amount integer, p_depositor text, p_deposited_at timestamptz, p_raw text, p_source text, p_dedupe text, p_note text, p_name_matched boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.estimate_terms%ROWTYPE; rid uuid;
BEGIN
 IF p_company IS NULL OR coalesce(p_estimate,'')='' OR p_kind NOT IN ('deposit','balance') OR coalesce(p_amount,0)<=0 OR p_source NOT IN ('sms_paste','manual') OR coalesce(p_dedupe,'')='' THEN
  RETURN jsonb_build_object('ok',false,'error','입금 기록 정보가 올바르지 않습니다.');
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_company::text || ':' || p_estimate,0));
 SELECT id INTO rid FROM public.deposit_records WHERE user_id=p_company AND (dedupe_key=p_dedupe OR linked_evidence_key=p_dedupe) LIMIT 1;
 IF rid IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'id',rid,'duplicate',true); END IF;
 SELECT * INTO t FROM public.estimate_terms WHERE user_id=p_company AND estimate_id=p_estimate AND deleted_at IS NULL ORDER BY sheet_version DESC, created_at DESC LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','견적을 찾지 못했습니다.'); END IF;
 -- One bank evidence links to at most one unlinked pending customer claim of the same kind and amount.
 SELECT id INTO rid FROM public.deposit_records WHERE user_id=p_company AND estimate_id=p_estimate AND source='customer_claim' AND status='pending_review' AND payment_kind=p_kind AND amount=p_amount AND linked_evidence_key IS NULL ORDER BY created_at LIMIT 1 FOR UPDATE;
 IF rid IS NOT NULL THEN
  UPDATE public.deposit_records SET linked_evidence_key=p_dedupe, raw_text=coalesce(raw_text,left(p_raw,2000)) WHERE id=rid AND user_id=p_company;
  RETURN jsonb_build_object('ok',true,'id',rid,'linked',true);
 END IF;
 INSERT INTO public.deposit_records(user_id,estimate_id,sheet_no,estimate_version,depositor_name,customer_name,amount,deposited_at,source,raw_text,name_matched,payment_kind,payment_method,status,review_note,dedupe_key)
 VALUES (p_company,p_estimate,t.sheet_no,coalesce(t.sheet_version,1),coalesce(p_depositor,''),coalesce(t.customer_name,''),p_amount,coalesce(p_deposited_at,now()),p_source,left(p_raw,2000),coalesce(p_name_matched,true),p_kind,'bank_transfer','pending_review',p_note,p_dedupe)
 RETURNING id INTO rid;
 RETURN jsonb_build_object('ok',true,'id',rid,'created',true);
END $$;
REVOKE ALL ON FUNCTION public.record_bank_receipt(uuid,text,text,integer,text,timestamptz,text,text,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_bank_receipt(uuid,text,text,integer,text,timestamptz,text,text,text,text,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_customer_balance(p_token text, p_confirmed boolean, p_seen integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c uuid; e text; t public.estimate_terms%ROWTYPE; due integer; rid uuid; st text; k text;
BEGIN
 IF coalesce(length(p_token),0) < 8 THEN RETURN jsonb_build_object('ok',false,'error','링크가 만료되었거나 잘못된 주소입니다.'); END IF;
 SELECT user_id, estimate_id INTO c, e FROM public.estimate_terms WHERE access_token=p_token AND deleted_at IS NULL;
 IF c IS NULL THEN RETURN jsonb_build_object('ok',false,'error','링크가 만료되었거나 잘못된 주소입니다.'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(c::text || ':' || e,0));
 SELECT * INTO t FROM public.estimate_terms WHERE access_token=p_token AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','링크가 만료되었거나 잘못된 주소입니다.'); END IF;
 IF p_confirmed IS DISTINCT FROM true THEN RETURN jsonb_build_object('ok',false,'error','실제로 잔금을 입금했는지 체크해 주세요.'); END IF;
 IF t.contract_status='cancelled' OR t.payment_status IN ('canceled','refunded') THEN RETURN jsonb_build_object('ok',false,'error','취소된 계약은 잔금 신고를 할 수 없습니다.'); END IF;
 IF t.payment_status='completed' THEN RETURN jsonb_build_object('ok',false,'error','이미 결제가 완료된 견적입니다.'); END IF;
 IF EXISTS (SELECT 1 FROM public.estimate_terms x WHERE x.user_id=c AND x.estimate_id=e AND x.deleted_at IS NULL AND x.id<>t.id AND (x.sheet_version>t.sheet_version OR (x.sheet_version=t.sheet_version AND x.created_at>t.created_at))) THEN
  RETURN jsonb_build_object('ok',false,'error','새 견적서가 있습니다. 업체에서 받은 최신 링크를 열어 주세요.');
 END IF;
 due := greatest(0, coalesce(t.total,0)-coalesce(t.deposit_paid,0)-coalesce(t.balance_paid,0));
 IF coalesce(t.deposit_paid,0)<=0 OR due<=0 THEN RETURN jsonb_build_object('ok',false,'error','잔금 신고를 할 수 없는 상태입니다. 견적서를 새로 열어 확인해 주세요.'); END IF;
 IF p_seen IS DISTINCT FROM due THEN RETURN jsonb_build_object('ok',false,'error','잔금 금액이 바뀌었습니다. 견적서를 새로 열어 금액을 다시 확인해 주세요.'); END IF;
 SELECT id INTO rid FROM public.deposit_records WHERE user_id=c AND estimate_id=e AND payment_kind='balance' AND status='pending_review' AND amount=due ORDER BY created_at LIMIT 1;
 IF rid IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'already',true,'pending',true,'amount',due); END IF;
 IF EXISTS (SELECT 1 FROM public.deposit_records WHERE user_id=c AND estimate_id=e AND payment_kind='balance' AND status='pending_review' AND amount>0) THEN
  RETURN jsonb_build_object('ok',false,'error','확인 대기 중인 잔금 입금이 있습니다. 업체 확인 후 다시 확인해 주세요.');
 END IF;
 k := 'claim|' || e || '|balance|' || coalesce(t.balance_paid,0)::text;
 SELECT status INTO st FROM public.deposit_records WHERE user_id=c AND dedupe_key=k;
 IF st IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'error','이전 신고가 처리되었습니다. 업체에 입금 내용을 문의해 주세요.'); END IF;
 INSERT INTO public.deposit_records(user_id,estimate_id,sheet_no,estimate_version,depositor_name,customer_name,amount,deposited_at,source,raw_text,name_matched,payment_kind,payment_method,status,review_note,dedupe_key)
 VALUES (c,e,t.sheet_no,coalesce(t.sheet_version,1),coalesce(t.customer_name,''),coalesce(t.customer_name,''),due,now(),'customer_claim',NULL,true,'balance','bank_transfer','pending_review','고객이 견적서에서 「잔금 입금했습니다」를 눌렀습니다(고객 자기확인). 통장 확인이 필요합니다.',k);
 RETURN jsonb_build_object('ok',true,'created',true,'pending',true,'amount',due);
END $$;
REVOKE ALL ON FUNCTION public.claim_customer_balance(text,boolean,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_customer_balance(text,boolean,integer) TO service_role;