CREATE OR REPLACE FUNCTION public.confirm_payment_receipt(_receipt_id uuid, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE r public.deposit_records%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', '로그인이 필요합니다.'); END IF;
 SELECT * INTO r FROM public.deposit_records WHERE id = _receipt_id AND user_id = auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', '입금 기록을 찾지 못했습니다.'); END IF;
 IF r.status = 'confirmed' THEN RETURN jsonb_build_object('ok', true, 'already', true, 'paid', r.amount, 'confirmedAt', r.confirmed_at); END IF;
 IF r.status <> 'pending_review' OR r.amount <= 0 THEN RETURN jsonb_build_object('ok', false, 'error', '확인 대기 중인 입금만 확인할 수 있습니다.'); END IF;
 UPDATE public.deposit_records SET status = 'confirmed', confirmed_at = now(), confirmed_by = auth.uid()
 WHERE id = r.id AND user_id = auth.uid() RETURNING * INTO r;
 RETURN jsonb_build_object('ok', true, 'paid', r.amount, 'confirmedAt', r.confirmed_at);
END $$;
REVOKE ALL ON FUNCTION public.confirm_payment_receipt(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_payment_receipt(uuid, text) TO authenticated;
COMMENT ON FUNCTION public.confirm_payment_receipt(uuid, text) IS 'Owner-scoped, locked receipt acknowledgement only. No estimate amount changes, SMS, notification logs, or reminder scheduling.';