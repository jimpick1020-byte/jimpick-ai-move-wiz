CREATE TABLE IF NOT EXISTS public.item_icons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  name text NOT NULL,
  norm_name text NOT NULL,
  cat text NOT NULL DEFAULT '기타',
  room text,
  image_path text,
  image_url text,
  status text NOT NULL DEFAULT 'pending',
  prompt text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.item_icons TO authenticated;
GRANT ALL ON public.item_icons TO service_role;

ALTER TABLE public.item_icons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item_icons_select_own" ON public.item_icons
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "item_icons_insert_own" ON public.item_icons
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND created_by = auth.uid());
CREATE POLICY "item_icons_update_own" ON public.item_icons
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE UNIQUE INDEX IF NOT EXISTS item_icons_user_norm_uniq
  ON public.item_icons (user_id, norm_name) WHERE active;
CREATE INDEX IF NOT EXISTS item_icons_user_created_idx
  ON public.item_icons (user_id, created_at DESC);

CREATE TRIGGER item_icons_updated_at BEFORE UPDATE ON public.item_icons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();