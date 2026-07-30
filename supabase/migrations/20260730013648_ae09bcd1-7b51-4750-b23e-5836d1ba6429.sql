DO $$
DECLARE c int;
BEGIN
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO c FROM public.profiles;
  SELECT count(*) INTO c FROM public.payments;
  SELECT count(*) INTO c FROM public.user_roles;
  RESET ROLE;
END $$;