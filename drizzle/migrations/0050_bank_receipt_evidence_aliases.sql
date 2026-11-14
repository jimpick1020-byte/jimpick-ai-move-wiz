CREATE TABLE IF NOT EXISTS public.deposit_receipt_aliases (
  user_id uuid NOT NULL,
  alias_key text NOT NULL,
  record_id uuid NOT NULL REFERENCES public.deposit_records(id),
  event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, alias_key)
);
REVOKE ALL ON public.deposit_receipt_aliases FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.deposit_receipt_aliases TO service_role;
ALTER TABLE public.deposit_receipt_aliases ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS deposit_receipt_aliases_record_idx ON public.deposit_receipt_aliases (record_id);

CREATE OR REPLACE FUNCTION public.record_bank_receipt_v2(p_company uuid, p_estimate text, p_kind text, p_amount integer, p_depositor text, p_deposited_at timestamptz, p_raw text, p_source text, p_dedupe text, p_note text, p_name_matched boolean, p_evidence text, p_event text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.estimate_terms%ROWTYPE; rid uuid; ev text := nullif(p_evidence,''); evt text := nullif(p_event,''); distinct_event boolean := false; has_text boolean := coalesce(p_raw,'') <> '';
BEGIN
 IF p_company IS NULL OR coalesce(p_estimate,'')='' OR p_kind NOT IN ('deposit','balance') OR coalesce(p_amount,0)<=0 OR p_source NOT IN ('sms_paste','manual') OR coalesce(p_dedupe,'')='' THEN
  RETURN jsonb_build_object('ok',false,'error','입금 기록 정보가 올바르지 않습니다.');
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_company::text || ':' || p_estimate,0));
 -- 1) Same path retry or legacy key.
 SELECT record_id INTO rid FROM public.deposit_receipt_aliases WHERE user_id=p_company AND alias_key=p_dedupe;
 IF rid IS NULL THEN SELECT id INTO rid FROM public.deposit_records WHERE user_id=p_company AND (dedupe_key=p_dedupe OR linked_evidence_key=p_dedupe) LIMIT 1; END IF;
 IF rid IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'id',rid,'duplicate',true); END IF;
 -- 2) Same bank evidence arriving through another path (paste / forward / estimate paste), unless both carry different bank event IDs.
 IF ev IS NOT NULL THEN
  SELECT record_id INTO rid FROM public.deposit_receipt_aliases WHERE user_id=p_company AND alias_key=ev;
  IF rid IS NOT NULL THEN
   IF evt IS NOT NULL AND EXISTS (SELECT 1 FROM public.deposit_receipt_aliases WHERE record_id=rid AND event_id IS NOT NULL AND event_id<>evt) THEN
    distinct_event := true; rid := NULL;
   ELSE
    INSERT INTO public.deposit_receipt_aliases(user_id,alias_key,record_id,event_id) VALUES (p_company,p_dedupe,rid,evt) ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('ok',true,'id',rid,'duplicate',true,'alias',true);
   END IF;
  END IF;
 END IF;
 SELECT * INTO t FROM public.estimate_terms WHERE user_id=p_company AND estimate_id=p_estimate AND deleted_at IS NULL ORDER BY sheet_version DESC, created_at DESC LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','견적을 찾지 못했습니다.'); END IF;
 -- 3) Insufficient bank text evidence: never merge or double-create when another bank-text receipt of the same kind and amount exists.
 IF ev IS NULL AND has_text AND EXISTS (
   SELECT 1 FROM public.deposit_records r WHERE r.user_id=p_company AND r.estimate_id=p_estimate AND r.payment_kind=p_kind AND r.amount=p_amount AND r.status IN ('pending_review','confirmed') AND coalesce(r.raw_text,'')<>''
   AND NOT (evt IS NOT NULL AND EXISTS (SELECT 1 FROM public.deposit_receipt_aliases a WHERE a.record_id=r.id AND a.event_id IS NOT NULL AND a.event_id<>evt))) THEN
  RETURN jsonb_build_object('ok',false,'review',true,'error','같은 금액의 은행 입금 기록이 이미 있어 확인이 필요합니다.');
 END IF;
 -- 4) Link 1:1 to an unlinked pending customer claim.
 SELECT id INTO rid FROM public.deposit_records WHERE user_id=p_company AND estimate_id=p_estimate AND source='customer_claim' AND status='pending_review' AND payment_kind=p_kind AND amount=p_amount AND linked_evidence_key IS NULL ORDER BY created_at LIMIT 1 FOR UPDATE;
 IF rid IS NOT NULL THEN
  UPDATE public.deposit_records SET linked_evidence_key=p_dedupe, raw_text=coalesce(raw_text,left(p_raw,2000)) WHERE id=rid AND user_id=p_company;
 ELSE
  INSERT INTO public.deposit_records(user_id,estimate_id,sheet_no,estimate_version,depositor_name,customer_name,amount,deposited_at,source,raw_text,name_matched,payment_kind,payment_method,status,review_note,dedupe_key)
  VALUES (p_company,p_estimate,t.sheet_no,coalesce(t.sheet_version,1),coalesce(p_depositor,''),coalesce(t.customer_name,''),p_amount,coalesce(p_deposited_at,now()),p_source,left(p_raw,2000),coalesce(p_name_matched,true),p_kind,'bank_transfer','pending_review',p_note,p_dedupe)
  RETURNING id INTO rid;
 END IF;
 INSERT INTO public.deposit_receipt_aliases(user_id,alias_key,record_id,event_id) VALUES (p_company,p_dedupe,rid,evt);
 IF ev IS NOT NULL AND NOT distinct_event THEN
  INSERT INTO public.deposit_receipt_aliases(user_id,alias_key,record_id,event_id) VALUES (p_company,ev,rid,evt);
 END IF;
 RETURN jsonb_build_object('ok',true,'id',rid,'created',true);
END $$;
REVOKE ALL ON FUNCTION public.record_bank_receipt_v2(uuid,text,text,integer,text,timestamptz,text,text,text,text,boolean,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_bank_receipt_v2(uuid,text,text,integer,text,timestamptz,text,text,text,text,boolean,text,text) TO service_role;