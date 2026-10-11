CREATE TABLE public.scan_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scan_id uuid,
  room text,
  detected_name text NOT NULL,
  detected_item_id text,
  confidence real,
  action text NOT NULL CHECK (action IN ('confirm','reject','saved','corrected')),
  final_item_id text,
  final_name text,
  final_qty integer,
  box jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.scan_feedback TO authenticated;
GRANT ALL ON public.scan_feedback TO service_role;
ALTER TABLE public.scan_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan_feedback own select" ON public.scan_feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "scan_feedback own insert" ON public.scan_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX scan_feedback_user_idx ON public.scan_feedback (user_id, created_at DESC);