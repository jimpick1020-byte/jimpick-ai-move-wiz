ALTER TABLE public.bank_sms_messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.bank_sms_messages ADD COLUMN IF NOT EXISTS deleted_by uuid;
COMMENT ON COLUMN public.bank_sms_messages.deleted_at IS 'Inbox-only hiding; retain original dedupe key and all payment links.';
CREATE OR REPLACE FUNCTION public.hide_bank_sms(p_message_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.bank_sms_messages SET deleted_at = coalesce(deleted_at, now()), deleted_by = coalesce(deleted_by, auth.uid()) WHERE id = p_message_id AND company_id = auth.uid() RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', '문자를 찾지 못했습니다.'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.hide_bank_sms(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hide_bank_sms(uuid) TO authenticated;
GRANT UPDATE(deleted_at, deleted_by) ON public.bank_sms_messages TO authenticated;
