REVOKE EXECUTE ON FUNCTION public.claim_move_reminders(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_move_reminders(integer) TO service_role;