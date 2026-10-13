ALTER TABLE public.deposit_records ADD COLUMN IF NOT EXISTS payment_kind text NOT NULL DEFAULT 'deposit';
CREATE OR REPLACE FUNCTION public.complete_receipted_estimate(_estimate_id text, _note text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE t public.estimate_terms%ROWTYPE; received bigint; n timestamptz:=now();
BEGIN
 IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok',false,'error','로그인이 필요합니다.'); END IF;
 SELECT * INTO t FROM public.estimate_terms WHERE user_id=auth.uid() AND estimate_id=_estimate_id AND deleted_at IS NULL ORDER BY sheet_version DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','견적을 찾지 못했습니다.'); END IF;
 IF t.payment_status IN ('canceled','refunded') THEN RETURN jsonb_build_object('ok',false,'error','취소·환불 견적은 완료할 수 없습니다.'); END IF;
 PERFORM id FROM public.deposit_records WHERE user_id=auth.uid() AND estimate_id=_estimate_id FOR UPDATE;
 SELECT coalesce(sum(amount),0) INTO received FROM public.deposit_records WHERE user_id=auth.uid() AND estimate_id=_estimate_id AND payment_kind='balance' AND source IN ('sms_paste','manual') AND status IN ('confirmed','pending_review') AND amount>0;
 IF t.total<=0 OR received<=0 OR coalesce(t.deposit_paid,0)+received<t.total THEN RETURN jsonb_build_object('ok',false,'error','실제 잔금 입금기록이 부족합니다.'); END IF;
 UPDATE public.deposit_records SET status='confirmed',confirmed_at=coalesce(confirmed_at,n),confirmed_by=coalesce(confirmed_by,auth.uid()) WHERE user_id=auth.uid() AND estimate_id=_estimate_id AND payment_kind='balance' AND source IN ('sms_paste','manual') AND status='pending_review' AND amount>0;
 UPDATE public.estimate_terms SET balance_paid=received,balance_paid_at=n,payment_status='completed',payment_confirmed_at=n,payment_confirmed_by=auth.uid(),paid_at=n,payment_note=_note,calendar_archived=true,calendar_archived_at=n,calendar_archived_by=auth.uid(),calendar_selected=false WHERE id=t.id AND user_id=auth.uid();
 RETURN jsonb_build_object('ok',true,'balancePaid',received,'confirmedAt',n);
END $$;
REVOKE ALL ON FUNCTION public.complete_receipted_estimate(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_receipted_estimate(text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.retire_unconverted_intake_drafts() RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r record; ids jsonb:='[]'::jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok',false,'ids',ids); END IF;
 FOR r IN SELECT d.id,d.estimate_id FROM public.estimate_drafts d JOIN public.intake_requests i ON i.estimate_id=d.estimate_id AND i.company_id=d.user_id WHERE d.user_id=auth.uid() AND d.deleted_at IS NULL AND i.status='submitted' AND i.confirmed_at IS NULL AND i.source_estimate_id IS NULL AND d.payload->>'intakeRequestId'=i.id::text AND coalesce(d.payload->>'status','')<>'완료' FOR UPDATE OF d,i LOOP
  IF NOT EXISTS(SELECT 1 FROM public.estimate_terms WHERE estimate_id=r.estimate_id AND user_id=auth.uid()) AND NOT EXISTS(SELECT 1 FROM public.deposit_records WHERE estimate_id=r.estimate_id AND user_id=auth.uid()) THEN
   UPDATE public.estimate_drafts SET deleted_at=now(),deleted_by=auth.uid(),deletion_source='history',deletion_reason='unconverted_intake_draft' WHERE id=r.id;
   UPDATE public.intake_requests SET status='cancelled',cancelled_at=now() WHERE estimate_id=r.estimate_id AND company_id=auth.uid() AND status='submitted';
   ids:=ids||jsonb_build_array(r.estimate_id);
  END IF;
 END LOOP;
 RETURN jsonb_build_object('ok',true,'ids',ids);
END $$;
REVOKE ALL ON FUNCTION public.retire_unconverted_intake_drafts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.retire_unconverted_intake_drafts() TO authenticated;