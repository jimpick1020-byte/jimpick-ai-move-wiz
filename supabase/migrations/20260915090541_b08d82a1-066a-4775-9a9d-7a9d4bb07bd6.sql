CREATE OR REPLACE FUNCTION public.cancel_reservation(_terms_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_cnt int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  UPDATE public.terms_acceptances
     SET reservation_status = 'canceled'
   WHERE estimate_terms_id = _terms_id
     AND user_id = auth.uid();
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  RETURN v_cnt > 0;
END $$;

REVOKE ALL ON FUNCTION public.cancel_reservation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_reservation(uuid) TO authenticated, service_role;