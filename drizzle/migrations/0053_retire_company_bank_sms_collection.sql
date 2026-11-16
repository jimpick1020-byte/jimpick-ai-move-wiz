REVOKE INSERT ON public.bank_sms_messages FROM anon, authenticated;
REVOKE INSERT, UPDATE ON public.bank_sms_ingest_tokens FROM anon, authenticated;
COMMENT ON TABLE public.bank_sms_ingest_tokens IS 'DEPRECATED: forwarding collection retired; historical credentials retained, public hook returns 410 and company creation/update disabled';