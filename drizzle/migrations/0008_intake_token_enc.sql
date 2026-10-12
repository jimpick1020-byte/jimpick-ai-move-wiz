ALTER TABLE public.intake_requests ADD COLUMN token_enc text;
REVOKE UPDATE ON public.intake_requests FROM authenticated;
GRANT UPDATE (status, cancelled_at, confirmed_at, owner_seen_at) ON public.intake_requests TO authenticated;