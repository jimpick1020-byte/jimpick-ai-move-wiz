ALTER TABLE public.estimate_terms ADD COLUMN IF NOT EXISTS planned_interim integer NOT NULL DEFAULT 0;
ALTER TABLE public.estimate_terms ADD COLUMN IF NOT EXISTS interim_paid integer NOT NULL DEFAULT 0;
ALTER TABLE public.estimate_terms ADD COLUMN IF NOT EXISTS storage_payment_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.estimate_terms ADD COLUMN IF NOT EXISTS storage_origin_completed_at timestamptz;
CREATE OR REPLACE FUNCTION public.sync_storage_payment_plan() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE d jsonb; q integer;
BEGIN
 IF TG_OP='INSERT' OR NEW.sheet_snapshot IS DISTINCT FROM OLD.sheet_snapshot OR NEW.total IS DISTINCT FROM OLD.total THEN
  d:=coalesce(NEW.sheet_snapshot::jsonb->'draft','{}'::jsonb);
  NEW.storage_payment_enabled:=coalesce(d->>'moveType','')='보관이사' OR coalesce((d->>'storageEnabled')::boolean,false);
  NEW.planned_interim:=CASE WHEN NEW.storage_payment_enabled THEN coalesce((d->>'plannedInterim')::integer,0) ELSE 0 END;
  q:=coalesce((d->>'depositOverride')::integer,(d->>'deposit')::integer,round(NEW.total::numeric/100000)*10000);
  IF NEW.planned_interim<0 OR (NEW.planned_interim>0 AND q+NEW.planned_interim>NEW.total) THEN RAISE EXCEPTION '예정 예약금과 중도금의 합계는 총 견적금액을 초과할 수 없습니다.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_storage_payment_plan BEFORE INSERT OR UPDATE ON public.estimate_terms FOR EACH ROW EXECUTE FUNCTION public.sync_storage_payment_plan();
CREATE OR REPLACE FUNCTION public.read_estimate_payments(p_company uuid,p_estimates text[])
RETURNS TABLE(estimate_id text,total integer,deposit_paid bigint,balance_paid bigint,payment_status text,deposit_paid_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 WITH latest AS (
 SELECT DISTINCT ON(t.estimate_id) t.* FROM public.estimate_terms t WHERE t.user_id=p_company AND t.estimate_id=ANY(p_estimates) AND t.deleted_at IS NULL AND (auth.uid()=p_company OR auth.role()='service_role') ORDER BY t.estimate_id,t.sheet_version DESC,t.created_at DESC
 ), ledger AS (
 SELECT r.estimate_id,sum(r.amount) FILTER(WHERE r.payment_kind='deposit') d,sum(r.amount) FILTER(WHERE r.payment_kind='balance') b,sum(r.amount) FILTER(WHERE r.payment_kind='interim') i,max(r.confirmed_at) FILTER(WHERE r.payment_kind='deposit') at FROM public.deposit_records r WHERE r.user_id=p_company AND r.estimate_id=ANY(p_estimates) AND r.status='confirmed' AND r.amount>0 GROUP BY r.estimate_id
 ), history AS (
 SELECT t.estimate_id,max(t.deposit_paid) FILTER(WHERE t.deposit_paid_at IS NOT NULL OR t.payment_confirmed_at IS NOT NULL) d,max(t.balance_paid) FILTER(WHERE t.balance_paid_at IS NOT NULL OR t.paid_at IS NOT NULL) b,max(t.deposit_paid_at) at FROM public.estimate_terms t WHERE t.user_id=p_company AND t.estimate_id=ANY(p_estimates) GROUP BY t.estimate_id
 ), amounts AS (
 SELECT t.*,coalesce(l.d,h.d,0) actual_d,CASE WHEN t.payment_method IN('cash','card') THEN greatest(coalesce(l.b,0),coalesce(h.b,0)) ELSE coalesce(l.b,h.b,0) END actual_b,coalesce(l.i,0) actual_i,coalesce(l.at,h.at) actual_at FROM latest t LEFT JOIN ledger l USING(estimate_id) LEFT JOIN history h USING(estimate_id)
 )
 SELECT a.estimate_id,a.total,a.actual_d,a.actual_b,CASE WHEN a.contract_status='cancelled' OR a.payment_status IN('canceled','refunded') THEN a.payment_status WHEN a.actual_i>0 AND a.actual_b=0 AND a.paid_at IS NULL THEN 'partial' WHEN a.actual_d+a.actual_b+a.actual_i>=a.total AND a.total>0 THEN 'completed' WHEN a.actual_b>0 THEN 'partial' WHEN a.actual_d>0 THEN 'deposit_paid' WHEN a.payment_status IN('deposit_paid','partial','completed','balance_paid') THEN 'unpaid' ELSE a.payment_status END,a.actual_at FROM amounts a
$$;
REVOKE ALL ON FUNCTION public.read_estimate_payments(uuid,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_estimate_payments(uuid,text[]) TO authenticated,service_role;
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.complete_estimate_payment(text,text,uuid,text,text)'::regprocedure) INTO definition;
 definition:=replace(definition,'due:=greatest(0,t.total-m.deposit_paid-m.balance_paid);','SELECT coalesce(sum(amount),0) INTO t.interim_paid FROM public.deposit_records WHERE user_id=auth.uid() AND estimate_id=_estimate_id AND payment_kind=''interim'' AND status=''confirmed''; due:=greatest(0,t.total-m.deposit_paid-m.balance_paid-t.interim_paid);');
 definition:=replace(definition,'complete:=m.deposit_paid+received>=t.total;','complete:=m.deposit_paid+received+t.interim_paid>=t.total;');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.claim_customer_balance(text,boolean,integer)'::regprocedure) INTO definition;
 definition:=replace(definition,'due:=greatest(0,m.total-m.deposit_paid-m.balance_paid);','SELECT coalesce(sum(amount),0) INTO t.interim_paid FROM public.deposit_records WHERE user_id=c AND estimate_id=e AND payment_kind=''interim'' AND status=''confirmed''; due:=greatest(0,m.total-m.deposit_paid-m.balance_paid-t.interim_paid); IF t.planned_interim>t.interim_paid THEN RETURN jsonb_build_object(''ok'',false,''error'',''중도금 확인 후 잔금 신고를 진행해 주세요.''); END IF;');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.confirm_payment_receipt(uuid,text)'::regprocedure) INTO definition;
 definition:=replace(definition,'IF r.payment_kind<>''deposit''','IF r.payment_kind NOT IN(''deposit'',''interim'')');
 definition:=replace(definition,'already:=r.status=''confirmed'';','IF r.payment_kind=''interim'' AND (NOT t.storage_payment_enabled OR t.storage_origin_completed_at IS NULL) THEN RETURN jsonb_build_object(''ok'',false,''error'',''출발지 작업 완료·보관 입고 확인 후 중도금을 확인해 주세요.''); END IF; already:=r.status=''confirmed'';');
 definition:=replace(definition,'SELECT * INTO m FROM public.read_estimate_payments(auth.uid(),ARRAY[r.estimate_id]);','SELECT coalesce(sum(amount),0) INTO t.interim_paid FROM public.deposit_records WHERE user_id=auth.uid() AND estimate_id=r.estimate_id AND payment_kind=''interim'' AND status=''confirmed'' AND amount>0; UPDATE public.estimate_terms SET interim_paid=t.interim_paid WHERE id=t.id; SELECT * INTO m FROM public.read_estimate_payments(auth.uid(),ARRAY[r.estimate_id]);');
 definition:=replace(definition,'payment_confirmed_at=coalesce(payment_confirmed_at,r.confirmed_at,n),payment_confirmed_by=coalesce(payment_confirmed_by,r.confirmed_by,auth.uid())','payment_confirmed_at=CASE WHEN already THEN payment_confirmed_at ELSE n END,payment_confirmed_by=CASE WHEN already THEN payment_confirmed_by ELSE auth.uid() END');
 definition:=replace(definition,'''depositPaid'',m.deposit_paid','''depositPaid'',m.deposit_paid,''interimPaid'',t.interim_paid');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.confirm_owner_bank_balance(text,integer,boolean)'::regprocedure) INTO definition;
 definition:=replace(definition,'result jsonb;','result jsonb; m record;');
 definition:=replace(definition,'due:=greatest(0,coalesce(t.total,0)-coalesce(t.deposit_paid,0)-coalesce(t.balance_paid,0));','SELECT * INTO m FROM public.read_estimate_payments(auth.uid(),ARRAY[_estimate_id]); SELECT coalesce(sum(amount),0) INTO t.interim_paid FROM public.deposit_records WHERE user_id=auth.uid() AND estimate_id=_estimate_id AND payment_kind=''interim'' AND status=''confirmed''; due:=greatest(0,m.total-m.deposit_paid-m.balance_paid-t.interim_paid);');
 EXECUTE definition;
END $migration$;
CREATE OR REPLACE FUNCTION public.read_storage_payments(p_company uuid,p_estimates text[])
RETURNS TABLE(estimate_id text,interim_paid bigint,planned_interim integer,storage_origin_completed_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT t.estimate_id,(SELECT coalesce(sum(r.amount),0) FROM public.deposit_records r WHERE r.user_id=p_company AND r.estimate_id=t.estimate_id AND r.payment_kind='interim' AND r.status='confirmed' AND r.amount>0),t.planned_interim,t.storage_origin_completed_at
 FROM (SELECT DISTINCT ON(x.estimate_id) x.* FROM public.estimate_terms x WHERE x.user_id=p_company AND x.estimate_id=ANY(p_estimates) AND x.deleted_at IS NULL AND (auth.uid()=p_company OR auth.role()='service_role') ORDER BY x.estimate_id,x.sheet_version DESC,x.created_at DESC) t
$$;
REVOKE ALL ON FUNCTION public.read_storage_payments(uuid,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_storage_payments(uuid,text[]) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.start_storage_interim(p_estimate text,p_confirmed boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE t public.estimate_terms%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR p_confirmed IS DISTINCT FROM true THEN RETURN jsonb_build_object('ok',false,'error','출발지 작업 완료와 보관 입고를 확인해 주세요.'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_estimate,0));
 SELECT * INTO t FROM public.estimate_terms WHERE user_id=auth.uid() AND estimate_id=p_estimate AND deleted_at IS NULL ORDER BY sheet_version DESC,created_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR NOT t.storage_payment_enabled OR t.planned_interim<=0 OR t.contract_status='cancelled' OR t.payment_status IN('canceled','refunded','completed') OR t.reservation_payment_choice='onsite_card' THEN RETURN jsonb_build_object('ok',false,'error','중도금 수납 가능한 보관 견적이 아닙니다.'); END IF;
 UPDATE public.estimate_terms SET storage_origin_completed_at=coalesce(storage_origin_completed_at,now()) WHERE user_id=auth.uid() AND estimate_id=p_estimate AND deleted_at IS NULL;
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.start_storage_interim(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_storage_interim(text,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.confirm_owner_interim(p_estimate text,p_amount integer,p_key uuid,p_reviewed boolean,p_receipt uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE t public.estimate_terms%ROWTYPE; r public.deposit_records%ROWTYPE; k text; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR p_reviewed IS DISTINCT FROM true OR p_amount IS NULL OR p_amount<=0 OR p_key IS NULL THEN RETURN jsonb_build_object('ok',false,'error','실제 받은 중도금을 입력하고 입금을 확인해 주세요.'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_estimate,0));
 SELECT * INTO t FROM public.estimate_terms WHERE user_id=auth.uid() AND estimate_id=p_estimate AND deleted_at IS NULL ORDER BY sheet_version DESC,created_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR NOT t.storage_payment_enabled OR t.planned_interim<=0 OR t.storage_origin_completed_at IS NULL OR t.contract_status='cancelled' OR t.payment_status IN('canceled','refunded') OR t.reservation_payment_choice='onsite_card' THEN RETURN jsonb_build_object('ok',false,'error','출발지 작업 완료·보관 입고 확인 후 중도금을 확인해 주세요.'); END IF;
 k:='owner-interim|'||p_estimate||'|'||p_key::text;
 SELECT * INTO r FROM public.deposit_records WHERE user_id=auth.uid() AND (dedupe_key=k OR linked_evidence_key=k) FOR UPDATE;
 IF NOT FOUND AND p_receipt IS NOT NULL THEN
  SELECT * INTO r FROM public.deposit_records WHERE id=p_receipt AND user_id=auth.uid() AND estimate_id=p_estimate AND payment_kind='interim' AND status IN('pending_review','confirmed') FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','확인할 중도금 신고를 찾지 못했습니다.'); END IF;
 END IF;
 IF r.id IS NULL THEN
  IF EXISTS(SELECT 1 FROM public.deposit_records WHERE user_id=auth.uid() AND estimate_id=p_estimate AND payment_kind='interim' AND status='pending_review') THEN RETURN jsonb_build_object('ok',false,'error','기존 중도금 신고를 먼저 확인해 주세요.'); END IF;
  PERFORM set_config('jimpick.receipt_ack_only','on',true);
  INSERT INTO public.deposit_records(user_id,estimate_id,sheet_no,estimate_version,depositor_name,customer_name,amount,deposited_at,source,name_matched,payment_kind,payment_method,status,review_note,dedupe_key)
  VALUES(auth.uid(),p_estimate,t.sheet_no,t.sheet_version,t.customer_name,t.customer_name,p_amount,now(),'manual',true,'interim','bank_transfer','pending_review','업체가 실제 받은 중도금을 직접 확인',k) RETURNING * INTO r;
 ELSE
  IF r.status='confirmed' AND r.amount<>p_amount THEN RETURN jsonb_build_object('ok',false,'error','이미 확인된 요청의 금액은 변경할 수 없습니다.'); END IF;
  IF r.status='pending_review' THEN UPDATE public.deposit_records SET amount=p_amount,review_note='업체가 실제 받은 금액 확인 (신고 금액 '||r.amount::text||'원)',linked_evidence_key=coalesce(linked_evidence_key,k) WHERE id=r.id; END IF;
 END IF;
 result:=public.confirm_payment_receipt(r.id);
 IF coalesce((result->>'ok')::boolean,false) IS DISTINCT FROM true THEN RAISE EXCEPTION '중도금 확인 저장 실패'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.confirm_owner_interim(text,integer,uuid,boolean,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_owner_interim(text,integer,uuid,boolean,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.claim_customer_interim(p_token text,p_confirmed boolean,p_seen integer,p_amount integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c uuid; e text; t public.estimate_terms%ROWTYPE; m record; due integer; i bigint; rid uuid; k text; st text;
BEGIN
 SELECT user_id,estimate_id INTO c,e FROM public.estimate_terms WHERE access_token=p_token AND deleted_at IS NULL;
 IF c IS NULL OR p_confirmed IS DISTINCT FROM true OR p_amount IS NULL OR p_amount<=0 THEN RETURN jsonb_build_object('ok',false,'error','실제로 입금한 중도금을 입력하고 확인해 주세요.'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(c::text||':'||e,0));
 SELECT * INTO t FROM public.estimate_terms WHERE user_id=c AND estimate_id=e AND deleted_at IS NULL ORDER BY sheet_version DESC,created_at DESC LIMIT 1 FOR UPDATE;
 SELECT * INTO m FROM public.read_estimate_payments(c,ARRAY[e]);
 SELECT coalesce(sum(amount),0) INTO i FROM public.deposit_records WHERE user_id=c AND estimate_id=e AND payment_kind='interim' AND status='confirmed';
 due:=least(greatest(0,t.planned_interim-i),greatest(0,m.total-m.deposit_paid-m.balance_paid-i));
 IF NOT t.storage_payment_enabled OR t.storage_origin_completed_at IS NULL OR t.contract_status='cancelled' OR t.payment_status IN('canceled','refunded','completed') OR t.reservation_payment_choice='onsite_card' OR m.deposit_paid<=0 OR due<=0 THEN RETURN jsonb_build_object('ok',false,'error','중도금 신고 가능한 단계가 아닙니다.'); END IF;
 IF p_seen IS DISTINCT FROM due THEN RETURN jsonb_build_object('ok',false,'error','중도금 금액이 변경되었습니다. 견적서를 다시 확인해 주세요.'); END IF;
 SELECT id INTO rid FROM public.deposit_records WHERE user_id=c AND estimate_id=e AND payment_kind='interim' AND status='pending_review' AND amount=p_amount LIMIT 1;
 IF rid IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'already',true,'amount',p_amount); END IF;
 IF EXISTS(SELECT 1 FROM public.deposit_records WHERE user_id=c AND estimate_id=e AND payment_kind='interim' AND status='pending_review') THEN RETURN jsonb_build_object('ok',false,'error','업체가 이전 중도금 신고를 확인 중입니다.'); END IF;
 k:='claim|'||e||'|interim|'||i::text;
 SELECT status INTO st FROM public.deposit_records WHERE user_id=c AND dedupe_key=k;
 IF st IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'error','이전 중도금 신고가 처리되었습니다. 업체에 문의해 주세요.'); END IF;
 INSERT INTO public.deposit_records(user_id,estimate_id,sheet_no,estimate_version,depositor_name,customer_name,amount,deposited_at,source,name_matched,payment_kind,payment_method,status,review_note,dedupe_key)
 VALUES(c,e,t.sheet_no,t.sheet_version,t.customer_name,t.customer_name,p_amount,now(),'customer_claim',true,'interim','bank_transfer','pending_review','고객 중도금 입금 신고. 업체 실제 계좌 확인 필요',k);
 RETURN jsonb_build_object('ok',true,'amount',p_amount);
END $$;
REVOKE ALL ON FUNCTION public.claim_customer_interim(text,boolean,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_customer_interim(text,boolean,integer,integer) TO service_role;
CREATE OR REPLACE FUNCTION public.notify_deposit_record() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k text; label text;
BEGIN
 IF NEW.status<>'pending_review' OR coalesce(NEW.amount,0)<=0 OR current_setting('jimpick.receipt_ack_only',true)='on' THEN RETURN NEW; END IF;
 k:=CASE WHEN NEW.payment_kind IN('balance','interim') THEN NEW.payment_kind ELSE 'deposit' END;
 label:=CASE k WHEN 'balance' THEN '잔금' WHEN 'interim' THEN '중도금' ELSE '예약금' END;
 INSERT INTO public.owner_notifications(company_id,kind,ref_id,dedupe_key,title,body,url)
 VALUES(NEW.user_id,CASE WHEN k='interim' THEN 'balance' ELSE k END,NEW.estimate_id,'deposit:'||NEW.id::text,label||' 입금 확인 필요',coalesce(nullif(NEW.customer_name,''),NEW.depositor_name,'고객')||' · '||label||' · '||to_char(NEW.amount,'FM999,999,999,999')||'원','/?notice='||CASE WHEN k='interim' THEN 'balance' ELSE k END||'&estimate='||NEW.estimate_id)
 ON CONFLICT(company_id,dedupe_key) DO NOTHING;
 RETURN NEW;
END $$;