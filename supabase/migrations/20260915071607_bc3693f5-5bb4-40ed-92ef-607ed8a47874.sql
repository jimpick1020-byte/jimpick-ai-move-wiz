REVOKE EXECUTE ON FUNCTION public.reserve_free_sms(uuid, text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_free_sms(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_free_sms(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_trial_identity_for(uuid, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sms_quota(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_trial_identity(text, text) FROM anon;