DROP POLICY IF EXISTS "item_icons_storage_select_own" ON storage.objects;
CREATE POLICY "item_icons_storage_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'item-icons'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "item_icons_storage_insert_own" ON storage.objects;
CREATE POLICY "item_icons_storage_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'item-icons'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "item_icons_storage_update_own" ON storage.objects;
CREATE POLICY "item_icons_storage_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'item-icons'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'item-icons'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );