CREATE TABLE public.company_size_presets (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_size_presets TO authenticated;
GRANT ALL ON public.company_size_presets TO service_role;

ALTER TABLE public.company_size_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own size presets select" ON public.company_size_presets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own size presets insert" ON public.company_size_presets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own size presets update" ON public.company_size_presets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own size presets delete" ON public.company_size_presets
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER company_size_presets_updated_at
  BEFORE UPDATE ON public.company_size_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();