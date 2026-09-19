CREATE TABLE public.experimental_feature_settings (
  setting_key text PRIMARY KEY DEFAULT 'global' CHECK (setting_key = 'global'),
  voice_item_input boolean NOT NULL DEFAULT false,
  ai_photo_scan boolean NOT NULL DEFAULT false,
  ai_video_scan boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.experimental_feature_settings TO service_role;

ALTER TABLE public.experimental_feature_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.experimental_feature_settings (
  setting_key,
  voice_item_input,
  ai_photo_scan,
  ai_video_scan
) VALUES ('global', false, false, false)
ON CONFLICT (setting_key) DO NOTHING;

CREATE TRIGGER experimental_feature_settings_updated_at
BEFORE UPDATE ON public.experimental_feature_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.experimental_feature_settings IS
  'Server-only global experiment flags. All default OFF; access is through authenticated super-admin server functions.';