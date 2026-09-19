CREATE POLICY "No direct authenticated access to experimental settings"
ON public.experimental_feature_settings
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);