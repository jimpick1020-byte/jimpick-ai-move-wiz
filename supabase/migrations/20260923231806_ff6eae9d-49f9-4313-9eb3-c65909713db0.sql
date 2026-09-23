CREATE TABLE public.room_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  estimate_id text NOT NULL,
  room text NOT NULL,
  photo_path text NOT NULL,
  photo_hash text,
  status text NOT NULL DEFAULT 'queued',
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_at timestamptz,
  analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_scans TO authenticated;
GRANT ALL ON public.room_scans TO service_role;
ALTER TABLE public.room_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "room_scans own select" ON public.room_scans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "room_scans own insert" ON public.room_scans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "room_scans own update" ON public.room_scans FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "room_scans own delete" ON public.room_scans FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX room_scans_estimate_idx ON public.room_scans (user_id, estimate_id, created_at);
CREATE TRIGGER update_room_scans_updated_at BEFORE UPDATE ON public.room_scans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "room-scans own read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'room-scans' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "room-scans own upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'room-scans' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "room-scans own update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'room-scans' AND (storage.foldername(name))[1] = auth.uid()::text);