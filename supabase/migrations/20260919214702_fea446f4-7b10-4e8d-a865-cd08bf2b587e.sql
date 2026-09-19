ALTER TABLE public.item_icons
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'company',
  ADD COLUMN IF NOT EXISTS default_volume numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS from_photo boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'item_icons_source_check'
  ) THEN
    ALTER TABLE public.item_icons
      ADD CONSTRAINT item_icons_source_check CHECK (source IN ('system','company','admin'));
  END IF;
END $$;