GRANT SELECT ON public.intake_requests TO authenticated;
GRANT UPDATE (visit_date, visit_time, visit_status) ON public.intake_requests TO authenticated;
GRANT ALL ON public.intake_requests TO service_role;