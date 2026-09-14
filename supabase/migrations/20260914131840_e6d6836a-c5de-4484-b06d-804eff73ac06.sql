CREATE TABLE public.app_cron_secrets (
  name text NOT NULL PRIMARY KEY,
  secret text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.app_cron_secrets TO service_role;

ALTER TABLE public.app_cron_secrets ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_cron_secrets (name) VALUES ('move_reminders')
ON CONFLICT (name) DO NOTHING;