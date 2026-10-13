CREATE TABLE IF NOT EXISTS public.estimate_purges (
  user_id uuid NOT NULL,
  estimate_id text NOT NULL,
  purged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, estimate_id)
);
COMMENT ON TABLE public.estimate_purges IS '영구 삭제된 견적번호만 남겨 다른 기기 목록에서도 지우는 용도 (고객정보 없음)';
GRANT SELECT ON public.estimate_purges TO authenticated;
GRANT ALL ON public.estimate_purges TO service_role;
ALTER TABLE public.estimate_purges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own purge markers" ON public.estimate_purges FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mark_estimate_purged()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('jimpick.purging', true) = 'on' THEN
    INSERT INTO public.estimate_purges(user_id, estimate_id) VALUES (OLD.user_id, OLD.estimate_id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS estimate_drafts_purge_marker ON public.estimate_drafts;
CREATE TRIGGER estimate_drafts_purge_marker AFTER DELETE ON public.estimate_drafts FOR EACH ROW EXECUTE FUNCTION public.mark_estimate_purged();
DROP TRIGGER IF EXISTS estimate_terms_purge_marker ON public.estimate_terms;
CREATE TRIGGER estimate_terms_purge_marker AFTER DELETE ON public.estimate_terms FOR EACH ROW EXECUTE FUNCTION public.mark_estimate_purged();

CREATE OR REPLACE FUNCTION public.run_unpaid_estimate_cleanup()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r int;
BEGIN
  PERFORM set_config('jimpick.purging', 'on', true);
  r := public.auto_archive_past_estimate_notices();
  PERFORM set_config('jimpick.purging', 'off', true);
  RETURN r;
END $$;
REVOKE EXECUTE ON FUNCTION public.run_unpaid_estimate_cleanup() FROM PUBLIC, anon, authenticated;