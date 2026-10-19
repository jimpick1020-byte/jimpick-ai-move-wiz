CREATE OR REPLACE FUNCTION public.confirm_payment_receipt(_receipt_id uuid, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE r public.deposit_records%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', '로그인이 필요합니다.'); END IF;
 SELECT * INTO r FROM public.deposit_records WHERE id = _receipt_id AND user_id = auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', '입금 기록을 찾지 못했습니다.'); END IF;
 IF r.status = 'confirmed' THEN RETURN jsonb_build_object('ok', true, 'already', true, 'paid', r.amount, 'confirmedAt', r.confirmed_at); END IF;
 IF r.status <> 'pending_review' OR r.amount <= 0 THEN RETURN jsonb_build_object('ok', false, 'error', '확인 대기 중인 입금만 확인할 수 있습니다.'); END IF;
 PERFORM set_config('jimpick.receipt_ack_only', 'on', true);
 UPDATE public.deposit_records SET status = 'confirmed', confirmed_at = now(), confirmed_by = auth.uid()
 WHERE id = r.id AND user_id = auth.uid() RETURNING * INTO r;
 PERFORM set_config('jimpick.receipt_ack_only', 'off', true);
 RETURN jsonb_build_object('ok', true, 'paid', r.amount, 'confirmedAt', r.confirmed_at);
END $$;
CREATE OR REPLACE FUNCTION public.complete_linked_intake_visit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF current_setting('jimpick.receipt_ack_only', true) = 'on' THEN RETURN NEW; END IF;
 IF public.has_confirmed_calendar_deposit(NEW.user_id, NEW.estimate_id) THEN
  UPDATE public.intake_requests SET visit_status='completed', visit_completed_at=coalesce(visit_completed_at,now()) WHERE company_id=NEW.user_id AND estimate_id=NEW.estimate_id AND visit_status='scheduled' AND deleted_at IS NULL;
 END IF;
 RETURN NEW;
END $$;