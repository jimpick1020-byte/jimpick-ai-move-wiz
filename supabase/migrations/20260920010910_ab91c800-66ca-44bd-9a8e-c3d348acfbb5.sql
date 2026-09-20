CREATE TABLE IF NOT EXISTS public.service_ops_settings (
  id boolean NOT NULL PRIMARY KEY DEFAULT true CHECK (id),
  notice_phone text,
  notify_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.service_ops_settings TO authenticated;
GRANT ALL ON public.service_ops_settings TO service_role;

ALTER TABLE public.service_ops_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admin reads ops settings" ON public.service_ops_settings;
CREATE POLICY "super admin reads ops settings" ON public.service_ops_settings
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin')
  );

DROP POLICY IF EXISTS "super admin inserts ops settings" ON public.service_ops_settings;
CREATE POLICY "super admin inserts ops settings" ON public.service_ops_settings
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin')
  );

DROP POLICY IF EXISTS "super admin updates ops settings" ON public.service_ops_settings;
CREATE POLICY "super admin updates ops settings" ON public.service_ops_settings
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin')
  );

INSERT INTO public.service_ops_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.service_fix_notices (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  error_log_id uuid REFERENCES public.error_logs (id) ON DELETE SET NULL,
  title text NOT NULL,
  summary text NOT NULL,
  to_masked text,
  status text NOT NULL DEFAULT 'queued',
  provider_message_id text,
  sent_at timestamp with time zone,
  failed_at timestamp with time zone,
  error_message text,
  source text NOT NULL DEFAULT 'auto',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_fix_notices_time_idx
  ON public.service_fix_notices (created_at DESC);

GRANT SELECT ON public.service_fix_notices TO authenticated;
GRANT ALL ON public.service_fix_notices TO service_role;

ALTER TABLE public.service_fix_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admin reads fix notices" ON public.service_fix_notices;
CREATE POLICY "super admin reads fix notices" ON public.service_fix_notices
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin')
  );

INSERT INTO public.app_cron_secrets (name) VALUES ('fix_notice') ON CONFLICT (name) DO NOTHING;