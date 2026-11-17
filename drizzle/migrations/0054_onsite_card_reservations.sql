ALTER TABLE public.estimate_terms ADD COLUMN reservation_payment_choice text, ADD COLUMN card_requested_at timestamptz, ADD COLUMN card_confirmed_at timestamptz, ADD COLUMN card_confirmed_by uuid;

CREATE OR REPLACE FUNCTION public.guard_card_reservation() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF (NEW.reservation_payment_choice IS DISTINCT FROM OLD.reservation_payment_choice OR NEW.card_requested_at IS DISTINCT FROM OLD.card_requested_at OR NEW.card_confirmed_at IS DISTINCT FROM OLD.card_confirmed_at OR NEW.card_confirmed_by IS DISTINCT FROM OLD.card_confirmed_by) AND current_setting('jimpick.card_write',true) IS DISTINCT FROM 'on' THEN RAISE EXCEPTION 'Use card reservation RPC'; END IF;
 IF NEW.reservation_payment_choice IS NOT NULL AND NEW.reservation_payment_choice NOT IN ('bank_transfer','onsite_card') THEN RAISE EXCEPTION 'Invalid reservation payment choice'; END IF;
 IF NEW.reservation_payment_choice='onsite_card' AND (NEW.deposit_paid IS DISTINCT FROM OLD.deposit_paid OR NEW.balance_paid IS DISTINCT FROM OLD.balance_paid OR NEW.payment_status IS DISTINCT FROM OLD.payment_status OR NEW.payment_method IS DISTINCT FROM OLD.payment_method) AND current_setting('jimpick.card_write',true) IS DISTINCT FROM 'on' AND NEW.payment_status NOT IN ('canceled','refunded') THEN RAISE EXCEPTION 'Use onsite card payment confirmation'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_card_reservation BEFORE UPDATE ON public.estimate_terms FOR EACH ROW EXECUTE FUNCTION public.guard_card_reservation();

CREATE OR REPLACE FUNCTION public.request_reservation_payment(_terms_id uuid,_choice text,_terms_snapshot text,_estimate_snapshot text,_accept_method text,_token_hint text,_user_agent text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.estimate_terms%ROWTYPE; result jsonb;
BEGIN
 IF _choice NOT IN ('bank_transfer','onsite_card') OR _choice IS NULL THEN RETURN jsonb_build_object('ok',false,'error','결제 방식을 선택해 주세요.'); END IF;
 SELECT * INTO t FROM public.estimate_terms WHERE id=_terms_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','not_found'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t.user_id::text || ':' || t.estimate_id,0));
 SELECT * INTO t FROM public.estimate_terms WHERE id=_terms_id FOR UPDATE;
 IF t.deleted_at IS NOT NULL OR t.contract_status='cancelled' OR t.payment_status IN ('completed','canceled','refunded') OR t.id IS DISTINCT FROM (SELECT id FROM public.estimate_terms WHERE user_id=t.user_id AND estimate_id=t.estimate_id AND deleted_at IS NULL ORDER BY sheet_version DESC,created_at DESC LIMIT 1) THEN RETURN jsonb_build_object('ok',false,'error','현재 예약 가능한 견적서가 아닙니다.'); END IF;
 IF t.reservation_payment_choice IS NOT NULL THEN
  IF t.reservation_payment_choice<>_choice THEN RETURN jsonb_build_object('ok',false,'error','이미 요청한 결제 방식은 업체에 문의해 주세요.'); END IF;
  RETURN jsonb_build_object('ok',true,'duplicate',true,'accepted_at',(SELECT accepted_at FROM public.terms_acceptances WHERE estimate_terms_id=t.id));
 END IF;
 IF _choice='onsite_card' AND (coalesce(t.deposit_paid,0)>0 OR coalesce(t.balance_paid,0)>0 OR EXISTS(SELECT 1 FROM public.terms_acceptances WHERE estimate_terms_id=t.id)) THEN RETURN jsonb_build_object('ok',false,'error','이미 예약·입금된 견적은 업체에 문의해 주세요.'); END IF;
 result:=public.confirm_reservation_atomic(t.id,_terms_snapshot,_estimate_snapshot,_accept_method,_token_hint,_user_agent);
 IF NOT coalesce((result->>'ok')::boolean,false) THEN RETURN result; END IF;
 PERFORM set_config('jimpick.card_write','on',true);
 UPDATE public.estimate_terms SET reservation_payment_choice=_choice,card_requested_at=CASE WHEN _choice='onsite_card' THEN now() ELSE NULL END WHERE id=t.id;
 PERFORM set_config('jimpick.card_write','off',true);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.request_reservation_payment(uuid,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_reservation_payment(uuid,text,text,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_onsite_card(_terms_id uuid,_complete boolean DEFAULT false,_terminal_confirmed boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.estimate_terms%ROWTYPE; actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('ok',false,'error','로그인이 필요합니다.'); END IF;
 SELECT * INTO t FROM public.estimate_terms WHERE id=_terms_id;
 IF NOT FOUND OR NOT (t.user_id=actor OR public.has_role(actor,'admin') OR public.has_role(actor,'super_admin')) THEN RETURN jsonb_build_object('ok',false,'error','예약을 확인할 권한이 없습니다.'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t.user_id::text || ':' || t.estimate_id,0));
 SELECT * INTO t FROM public.estimate_terms WHERE id=_terms_id FOR UPDATE;
 IF t.deleted_at IS NOT NULL OR t.contract_status='cancelled' OR t.payment_status IN ('canceled','refunded') OR t.reservation_payment_choice IS DISTINCT FROM 'onsite_card' OR t.card_requested_at IS NULL OR t.id IS DISTINCT FROM (SELECT id FROM public.estimate_terms WHERE user_id=t.user_id AND estimate_id=t.estimate_id AND deleted_at IS NULL ORDER BY sheet_version DESC,created_at DESC LIMIT 1) THEN RETURN jsonb_build_object('ok',false,'error','현재 확인 가능한 카드 예약이 아닙니다.'); END IF;
 IF _complete AND (NOT coalesce(_terminal_confirmed,false) OR t.card_confirmed_at IS NULL OR t.total<=0) THEN RETURN jsonb_build_object('ok',false,'error','예약 확정 후 실제 단말기 카드 승인을 확인해 주세요.'); END IF;
 IF (_complete AND t.payment_status='completed') OR (NOT _complete AND t.card_confirmed_at IS NOT NULL) THEN RETURN jsonb_build_object('ok',true,'duplicate',true); END IF;
 PERFORM set_config('jimpick.card_write','on',true);
 IF _complete THEN
  UPDATE public.estimate_terms SET balance_paid=greatest(0,total-coalesce(deposit_paid,0)),balance_paid_at=now(),payment_status='completed',payment_method='card',payment_amount=greatest(0,total-coalesce(deposit_paid,0)-coalesce(balance_paid,0)),paid_at=now(),payment_confirmed_at=now(),payment_confirmed_by=actor,calendar_archived=true,calendar_archived_at=now(),calendar_archived_by=actor,calendar_selected=false WHERE id=t.id;
 ELSE
  UPDATE public.estimate_terms SET card_confirmed_at=now(),card_confirmed_by=actor WHERE id=t.id;
  UPDATE public.terms_acceptances SET reservation_status='confirmed',confirmed_by='owner',confirmed_by_user_id=actor WHERE estimate_terms_id=t.id;
 END IF;
 PERFORM set_config('jimpick.card_write','off',true);
 RETURN jsonb_build_object('ok',true,'completed',_complete);
END $$;
REVOKE ALL ON FUNCTION public.confirm_onsite_card(uuid,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_onsite_card(uuid,boolean,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_card_reservation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.reservation_payment_choice='onsite_card' AND NEW.card_requested_at IS NOT NULL AND OLD.card_requested_at IS NULL THEN
 INSERT INTO public.owner_notifications(company_id,kind,ref_id,dedupe_key,title,body,url) VALUES(NEW.user_id,'card_reservation',NEW.estimate_id,'card-reservation:'||NEW.estimate_id,'현장 카드 결제 예약 요청',coalesce(NEW.customer_name,'고객')||' · 예약 확인 대기 · 예약금 없음','/?notice=card_reservation&estimate='||NEW.estimate_id) ON CONFLICT(company_id,dedupe_key) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER notify_card_reservation AFTER UPDATE OF card_requested_at ON public.estimate_terms FOR EACH ROW EXECUTE FUNCTION public.notify_card_reservation();