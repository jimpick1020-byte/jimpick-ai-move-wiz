CREATE OR REPLACE FUNCTION public.read_estimate_payments(p_company uuid,p_estimates text[])
RETURNS TABLE(estimate_id text,total integer,deposit_paid bigint,balance_paid bigint,payment_status text,deposit_paid_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 WITH latest AS (
 SELECT DISTINCT ON(t.estimate_id) t.* FROM public.estimate_terms t WHERE t.user_id=p_company AND t.estimate_id=ANY(p_estimates) AND t.deleted_at IS NULL AND (auth.uid()=p_company OR auth.role()='service_role') ORDER BY t.estimate_id,t.sheet_version DESC,t.created_at DESC
 ), ledger AS (
 SELECT r.estimate_id,sum(r.amount) FILTER(WHERE r.payment_kind='deposit') d,sum(r.amount) FILTER(WHERE r.payment_kind='balance') b,max(r.confirmed_at) FILTER(WHERE r.payment_kind='deposit') at FROM public.deposit_records r WHERE r.user_id=p_company AND r.estimate_id=ANY(p_estimates) AND r.status='confirmed' AND r.amount>0 GROUP BY r.estimate_id
 ), history AS (
 SELECT t.estimate_id,max(t.deposit_paid) FILTER(WHERE t.deposit_paid_at IS NOT NULL OR t.payment_confirmed_at IS NOT NULL) d,max(t.balance_paid) FILTER(WHERE t.balance_paid_at IS NOT NULL OR t.paid_at IS NOT NULL) b,max(t.deposit_paid_at) at FROM public.estimate_terms t WHERE t.user_id=p_company AND t.estimate_id=ANY(p_estimates) GROUP BY t.estimate_id
 ), amounts AS (
 SELECT t.*,coalesce(l.d,h.d,0) actual_d,CASE WHEN t.payment_method IN('cash','card') THEN greatest(coalesce(l.b,0),coalesce(h.b,0)) ELSE coalesce(l.b,h.b,0) END actual_b,coalesce(l.at,h.at) actual_at FROM latest t LEFT JOIN ledger l USING(estimate_id) LEFT JOIN history h USING(estimate_id)
 )
 SELECT a.estimate_id,a.total,a.actual_d,a.actual_b,CASE WHEN a.contract_status='cancelled' OR a.payment_status IN('canceled','refunded') THEN a.payment_status WHEN a.actual_d+a.actual_b>=a.total AND a.total>0 THEN 'completed' WHEN a.actual_b>0 THEN 'partial' WHEN a.actual_d>0 THEN 'deposit_paid' WHEN a.payment_status IN('deposit_paid','partial','completed','balance_paid') THEN 'unpaid' ELSE a.payment_status END,a.actual_at FROM amounts a
$$;
REVOKE ALL ON FUNCTION public.read_estimate_payments(uuid,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_estimate_payments(uuid,text[]) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.claim_customer_balance(p_token text,p_confirmed boolean,p_seen integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c uuid; e text; t public.estimate_terms%ROWTYPE; m record; due integer; rid uuid; st text; k text;
BEGIN
 IF coalesce(length(p_token),0)<8 THEN RETURN jsonb_build_object('ok',false,'error','링크가 만료되었거나 잘못된 주소입니다.'); END IF;
 SELECT user_id,estimate_id INTO c,e FROM public.estimate_terms WHERE access_token=p_token AND deleted_at IS NULL;
 IF c IS NULL THEN RETURN jsonb_build_object('ok',false,'error','링크가 만료되었거나 잘못된 주소입니다.'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(c::text||':'||e,0));
 SELECT * INTO t FROM public.estimate_terms WHERE user_id=c AND estimate_id=e AND deleted_at IS NULL ORDER BY sheet_version DESC,created_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','견적서를 찾지 못했습니다.'); END IF;
 IF p_confirmed IS DISTINCT FROM true THEN RETURN jsonb_build_object('ok',false,'error','실제로 잔금을 입금했는지 체크해 주세요.'); END IF;
 IF t.contract_status='cancelled' OR t.payment_status IN('canceled','refunded') OR t.reservation_payment_choice='onsite_card' THEN RETURN jsonb_build_object('ok',false,'error','현재 입금 신고 가능한 계약이 아닙니다.'); END IF;
 SELECT * INTO m FROM public.read_estimate_payments(c,ARRAY[e]);
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','입금 금액을 확인하지 못했습니다.'); END IF;
 due:=greatest(0,m.total-m.deposit_paid-m.balance_paid);
 IF m.deposit_paid<=0 OR due<=0 THEN RETURN jsonb_build_object('ok',false,'error','잔금 신고를 할 수 없는 상태입니다. 견적서를 다시 확인해 주세요.'); END IF;
 IF p_seen IS DISTINCT FROM due THEN RETURN jsonb_build_object('ok',false,'error','잔금 금액이 바뀌었습니다. 견적서를 다시 확인해 주세요.'); END IF;
 SELECT id INTO rid FROM public.deposit_records WHERE user_id=c AND estimate_id=e AND payment_kind='balance' AND status='pending_review' AND amount=due ORDER BY created_at LIMIT 1;
 IF rid IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'already',true,'pending',true,'amount',due); END IF;
 IF EXISTS(SELECT 1 FROM public.deposit_records WHERE user_id=c AND estimate_id=e AND payment_kind='balance' AND status='pending_review' AND amount>0) THEN RETURN jsonb_build_object('ok',false,'error','확인 대기 중인 잔금 입금이 있습니다. 업체 확인 후 다시 확인해 주세요.'); END IF;
 k:='claim|'||e||'|balance|'||m.balance_paid::text;
 SELECT status INTO st FROM public.deposit_records WHERE user_id=c AND dedupe_key=k;
 IF st IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'error','이전 신고가 처리되었습니다. 업체에 입금 내용을 문의해 주세요.'); END IF;
 INSERT INTO public.deposit_records(user_id,estimate_id,sheet_no,estimate_version,depositor_name,customer_name,amount,deposited_at,source,raw_text,name_matched,payment_kind,payment_method,status,review_note,dedupe_key) VALUES(c,e,t.sheet_no,coalesce(t.sheet_version,1),coalesce(t.customer_name,''),coalesce(t.customer_name,''),due,now(),'customer_claim',NULL,true,'balance','bank_transfer','pending_review','고객 잔금 입금 신고입니다. 실제 계좌 확인이 필요합니다.',k);
 RETURN jsonb_build_object('ok',true,'created',true,'pending',true,'amount',due);
END $$;
REVOKE ALL ON FUNCTION public.claim_customer_balance(text,boolean,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_customer_balance(text,boolean,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_estimate_payment(_estimate_id text,_method text,_receipt_id uuid DEFAULT NULL,_note text DEFAULT NULL,_approval text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE t public.estimate_terms%ROWTYPE; r public.deposit_records%ROWTYPE; m record; n timestamptz:=now(); received bigint; due integer; complete boolean; already boolean;
BEGIN
 IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok',false,'error','로그인이 필요합니다.'); END IF;
 IF _method IS NULL OR _method NOT IN('cash','bank_transfer','card') THEN RETURN jsonb_build_object('ok',false,'error','결제수단을 선택해 주세요.'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||_estimate_id,0));
 SELECT * INTO t FROM public.estimate_terms WHERE user_id=auth.uid() AND estimate_id=_estimate_id AND deleted_at IS NULL ORDER BY sheet_version DESC,created_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','견적을 찾지 못했습니다.'); END IF;
 IF t.payment_status IN('canceled','refunded') OR t.contract_status='cancelled' THEN RETURN jsonb_build_object('ok',false,'error','취소·환불 견적은 완료할 수 없습니다.'); END IF;
 IF t.reservation_payment_choice='onsite_card' THEN RETURN jsonb_build_object('ok',false,'error','현장 카드 결제 확인을 이용해 주세요.'); END IF;
 SELECT * INTO m FROM public.read_estimate_payments(auth.uid(),ARRAY[_estimate_id]);
 due:=greatest(0,t.total-m.deposit_paid-m.balance_paid);
 IF t.total<=0 THEN RETURN jsonb_build_object('ok',false,'error','견적 금액이 없어 완료할 수 없습니다.'); END IF;
 PERFORM set_config('jimpick.receipt_ack_only','on',true);
 IF _method='bank_transfer' THEN
 SELECT * INTO r FROM public.deposit_records WHERE id=_receipt_id AND user_id=auth.uid() AND estimate_id=_estimate_id FOR UPDATE;
 IF NOT FOUND OR r.amount<=0 OR r.status NOT IN('pending_review','confirmed') OR r.payment_kind<>'balance' OR (r.payment_method IS NOT NULL AND r.payment_method<>'bank_transfer') THEN RETURN jsonb_build_object('ok',false,'error','확인할 잔금 입금기록을 선택해 주세요.'); END IF;
 already:=r.status='confirmed';
 UPDATE public.deposit_records SET status='confirmed',payment_method='bank_transfer',confirmed_at=coalesce(confirmed_at,n),confirmed_by=coalesce(confirmed_by,auth.uid()) WHERE id=r.id AND user_id=auth.uid();
 SELECT * INTO m FROM public.read_estimate_payments(auth.uid(),ARRAY[_estimate_id]);
 received:=m.balance_paid;
 ELSE
 IF due=0 THEN RETURN jsonb_build_object('ok',true,'already',true,'completed',true,'balancePaid',m.balance_paid); END IF;
 received:=m.balance_paid+due;
 END IF;
 complete:=m.deposit_paid+received>=t.total;
 UPDATE public.estimate_terms SET deposit_paid=m.deposit_paid,balance_paid=received,balance_paid_at=CASE WHEN already THEN coalesce(balance_paid_at,n) ELSE n END,payment_method=_method,payment_amount=CASE WHEN _method='bank_transfer' THEN r.amount ELSE due END,payment_status=CASE WHEN complete THEN 'completed' ELSE 'partial' END,payment_confirmed_at=CASE WHEN already THEN coalesce(payment_confirmed_at,n) ELSE n END,payment_confirmed_by=CASE WHEN already THEN coalesce(payment_confirmed_by,auth.uid()) ELSE auth.uid() END,paid_at=CASE WHEN complete THEN coalesce(paid_at,n) ELSE paid_at END,payment_note=coalesce(nullif(trim(_note),''),payment_note),card_approval_number=CASE WHEN _method='card' THEN nullif(trim(_approval),'') ELSE card_approval_number END,calendar_archived=CASE WHEN complete THEN true ELSE calendar_archived END,calendar_archived_at=CASE WHEN complete THEN coalesce(calendar_archived_at,n) ELSE calendar_archived_at END,calendar_archived_by=CASE WHEN complete THEN coalesce(calendar_archived_by,auth.uid()) ELSE calendar_archived_by END,calendar_selected=CASE WHEN complete THEN false ELSE calendar_selected END WHERE id=t.id AND user_id=auth.uid();
 PERFORM set_config('jimpick.receipt_ack_only','off',true);
 RETURN jsonb_build_object('ok',true,'already',coalesce(already,false),'completed',complete,'balancePaid',received,'paid',CASE WHEN _method='bank_transfer' THEN r.amount ELSE due END,'confirmedAt',coalesce(r.confirmed_at,n));
END $$;

CREATE OR REPLACE FUNCTION public.confirm_payment_receipt(_receipt_id uuid,_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r public.deposit_records%ROWTYPE; t public.estimate_terms%ROWTYPE; m record; n timestamptz:=now(); already boolean;
BEGIN
 IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok',false,'error','로그인이 필요합니다.'); END IF;
 SELECT * INTO r FROM public.deposit_records WHERE id=_receipt_id AND user_id=auth.uid();
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','입금 기록을 찾지 못했습니다.'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||r.estimate_id,0));
 SELECT * INTO t FROM public.estimate_terms WHERE user_id=auth.uid() AND estimate_id=r.estimate_id AND deleted_at IS NULL ORDER BY sheet_version DESC,created_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','견적을 찾지 못했습니다.'); END IF;
 IF t.payment_status IN('canceled','refunded') OR t.contract_status='cancelled' OR t.reservation_payment_choice='onsite_card' THEN RETURN jsonb_build_object('ok',false,'error','현재 확인 가능한 계좌 입금이 아닙니다.'); END IF;
 SELECT * INTO r FROM public.deposit_records WHERE id=_receipt_id AND user_id=auth.uid() FOR UPDATE;
 IF r.payment_kind='balance' THEN RETURN public.complete_estimate_payment(r.estimate_id,'bank_transfer',r.id,_note); END IF;
 IF r.payment_kind<>'deposit' OR r.status NOT IN('pending_review','confirmed') OR r.amount<=0 OR (r.payment_method IS NOT NULL AND r.payment_method<>'bank_transfer') THEN RETURN jsonb_build_object('ok',false,'error','확인할 예약금 기록이 없습니다.'); END IF;
 already:=r.status='confirmed';
 PERFORM set_config('jimpick.receipt_ack_only','on',true);
 UPDATE public.deposit_records SET status='confirmed',payment_method='bank_transfer',confirmed_at=coalesce(confirmed_at,n),confirmed_by=coalesce(confirmed_by,auth.uid()) WHERE id=r.id AND user_id=auth.uid() RETURNING * INTO r;
 SELECT * INTO m FROM public.read_estimate_payments(auth.uid(),ARRAY[r.estimate_id]);
 UPDATE public.estimate_terms SET deposit_paid=m.deposit_paid,balance_paid=m.balance_paid,deposit_paid_at=m.deposit_paid_at,payment_status=m.payment_status,payment_method=CASE WHEN m.balance_paid>0 THEN payment_method ELSE 'bank_transfer' END,payment_confirmed_at=coalesce(payment_confirmed_at,r.confirmed_at,n),payment_confirmed_by=coalesce(payment_confirmed_by,r.confirmed_by,auth.uid()) WHERE id=t.id AND user_id=auth.uid();
 PERFORM set_config('jimpick.receipt_ack_only','off',true);
 RETURN jsonb_build_object('ok',true,'already',already,'paid',r.amount,'depositPaid',m.deposit_paid,'confirmedAt',r.confirmed_at);
END $$;
REVOKE ALL ON FUNCTION public.confirm_payment_receipt(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_payment_receipt(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.complete_estimate_payment(text,text,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_estimate_payment(text,text,uuid,text,text) TO authenticated;