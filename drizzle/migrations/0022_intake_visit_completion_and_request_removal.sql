ALTER TABLE public.intake_requests ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS visit_completed_at timestamptz;
CREATE OR REPLACE FUNCTION public.has_confirmed_calendar_deposit(p_company uuid, p_estimate text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM public.estimate_terms t WHERE t.user_id=p_company AND t.estimate_id=p_estimate AND t.deleted_at IS NULL AND t.contract_status <> 'cancelled' AND t.payment_status IN ('deposit_paid','partial','completed') AND t.deposit_paid > 0 AND (t.deposit_paid_at IS NOT NULL OR t.payment_confirmed_at IS NOT NULL) AND t.sheet_version = (SELECT max(t2.sheet_version) FROM public.estimate_terms t2 WHERE t2.user_id=p_company AND t2.estimate_id=p_estimate AND t2.deleted_at IS NULL) AND EXISTS (SELECT 1 FROM public.deposit_records d WHERE d.user_id=p_company AND d.estimate_id=p_estimate AND d.payment_kind='deposit' AND d.status='confirmed' AND d.amount>0 AND d.confirmed_at IS NOT NULL AND d.confirmed_by IS NOT NULL));
$$;
REVOKE ALL ON FUNCTION public.has_confirmed_calendar_deposit(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_confirmed_calendar_deposit(uuid,text) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.complete_linked_intake_visit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF public.has_confirmed_calendar_deposit(NEW.user_id, NEW.estimate_id) THEN
  UPDATE public.intake_requests SET visit_status='completed', visit_completed_at=coalesce(visit_completed_at,now()) WHERE company_id=NEW.user_id AND estimate_id=NEW.estimate_id AND visit_status='scheduled' AND deleted_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER intake_visit_after_terms_payment AFTER INSERT OR UPDATE OF payment_status,deposit_paid,deposit_paid_at,payment_confirmed_at ON public.estimate_terms FOR EACH ROW EXECUTE FUNCTION public.complete_linked_intake_visit();
CREATE TRIGGER intake_visit_after_receipt_confirmation AFTER INSERT OR UPDATE OF status,confirmed_at,confirmed_by ON public.deposit_records FOR EACH ROW EXECUTE FUNCTION public.complete_linked_intake_visit();
CREATE OR REPLACE FUNCTION public.guard_completed_intake_visit() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF OLD.visit_completed_at IS NOT NULL THEN
  NEW.visit_completed_at := OLD.visit_completed_at;
  IF NEW.deleted_at IS NULL THEN NEW.visit_status := 'completed'; END IF;
 END IF;
 IF NEW.visit_status='scheduled' AND public.has_confirmed_calendar_deposit(NEW.company_id,NEW.estimate_id) THEN NEW.visit_status:='completed'; NEW.visit_completed_at:=coalesce(NEW.visit_completed_at,now()); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER intake_visit_completion_guard BEFORE UPDATE ON public.intake_requests FOR EACH ROW EXECUTE FUNCTION public.guard_completed_intake_visit();
CREATE OR REPLACE FUNCTION public.delete_intake_request(p_request_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.intake_requests%ROWTYPE; protected boolean; now_at timestamptz:=now();
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 SELECT * INTO r FROM public.intake_requests WHERE id=p_request_id AND company_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','요청을 찾지 못했습니다.'); END IF;
 PERFORM id FROM public.estimate_drafts WHERE user_id=r.company_id AND estimate_id=r.estimate_id FOR UPDATE;
 SELECT EXISTS(SELECT 1 FROM public.estimate_terms t WHERE t.user_id=r.company_id AND t.estimate_id=r.estimate_id) OR EXISTS(SELECT 1 FROM public.deposit_records d WHERE d.user_id=r.company_id AND d.estimate_id=r.estimate_id) INTO protected;
 IF NOT protected THEN
  UPDATE public.estimate_drafts SET deleted_at=coalesce(deleted_at,now_at),deleted_by=auth.uid(),deletion_source='intake_request',deletion_reason='고객 요청 삭제',revision=revision+1 WHERE user_id=r.company_id AND estimate_id=r.estimate_id AND payload->>'intakeRequestId'=r.id::text;
 END IF;
 UPDATE public.intake_requests SET deleted_at=coalesce(deleted_at,now_at),status='cancelled',cancelled_at=coalesce(cancelled_at,now_at),visit_date=NULL,visit_time=NULL,visit_status='none' WHERE id=r.id AND company_id=r.company_id;
 RETURN jsonb_build_object('ok',true,'estimateId',r.estimate_id,'requestId',r.id,'draftDeleted',NOT protected,'formalPreserved',protected);
END $$;
REVOKE ALL ON FUNCTION public.delete_intake_request(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_intake_request(uuid) TO authenticated;
COMMENT ON COLUMN public.intake_requests.deleted_at IS 'Owner request removal marker: preserves customer submission and SMS audit while removing request, visit and unconverted draft from active surfaces.';
COMMENT ON COLUMN public.intake_requests.visit_completed_at IS 'Permanent completion timestamp after actual owner-confirmed deposit; refunds never reopen visit.';