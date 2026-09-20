CREATE INDEX IF NOT EXISTS item_icons_user_ready_idx
  ON public.item_icons (user_id, created_at DESC)
  WHERE active AND status = 'ready';