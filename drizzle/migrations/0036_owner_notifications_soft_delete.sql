ALTER TABLE public.owner_notifications ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS owner_notifications_live_idx ON public.owner_notifications (company_id, created_at DESC) WHERE deleted_at IS NULL;
-- 사장님은 읽음 표시와 삭제 표시만 바꿀 수 있습니다. 삭제 표시는 되돌릴 수 없습니다 (중복 방지 키는 그대로 남음).
CREATE OR REPLACE FUNCTION public.guard_owner_notification_update() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF NEW.company_id <> OLD.company_id OR NEW.kind <> OLD.kind OR NEW.ref_id <> OLD.ref_id OR NEW.dedupe_key <> OLD.dedupe_key
       OR NEW.title <> OLD.title OR NEW.body <> OLD.body OR NEW.url <> OLD.url OR NEW.created_at <> OLD.created_at
       OR NEW.pushed_at IS DISTINCT FROM OLD.pushed_at OR NEW.push_error IS DISTINCT FROM OLD.push_error
       OR (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) THEN
      RAISE EXCEPTION 'only read_at/deleted_at can change';
    END IF;
  END IF;
  RETURN NEW;
END $$;