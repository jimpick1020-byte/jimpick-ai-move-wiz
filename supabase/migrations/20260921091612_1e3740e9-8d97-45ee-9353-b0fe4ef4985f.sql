REVOKE ALL ON FUNCTION public.mark_reminder_viewed(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_reminder_viewed(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_reminder_viewed(text) TO service_role;