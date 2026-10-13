ALTER TABLE public.item_icons
 ADD COLUMN customer_visible boolean,
 ADD COLUMN customer_room text[] NOT NULL DEFAULT '{}',
 ADD COLUMN customer_order integer NOT NULL DEFAULT 1000,
 ADD COLUMN customer_category text,
 ADD COLUMN customer_name text,
 ADD COLUMN customer_size text NOT NULL DEFAULT '',
 ADD COLUMN customer_disposal_allowed boolean NOT NULL DEFAULT true,
 ADD COLUMN customer_only boolean NOT NULL DEFAULT false,
 ADD COLUMN customer_key text,
 ADD COLUMN customer_deleted_at timestamptz;
UPDATE public.item_icons SET customer_visible=intake_visible,customer_room=intake_rooms,customer_order=intake_sort,customer_category=CASE WHEN category_group='가전' THEN '가전' ELSE '가구' END,customer_name=display_name WHERE intake_visible=true;
CREATE UNIQUE INDEX item_icons_customer_key_unique ON public.item_icons(customer_key) WHERE customer_key IS NOT NULL;
CREATE FUNCTION public.guard_customer_catalog_settings() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user IN ('postgres','service_role','supabase_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
   IF NEW.customer_only OR NEW.customer_key IS NOT NULL OR NEW.customer_visible IS NOT NULL THEN RAISE EXCEPTION 'Customer catalog requires platform administrator'; END IF;
 ELSE
   IF ROW(NEW.customer_visible,NEW.customer_room,NEW.customer_order,NEW.customer_category,NEW.customer_name,NEW.customer_size,NEW.customer_disposal_allowed,NEW.customer_only,NEW.customer_key,NEW.customer_deleted_at) IS DISTINCT FROM ROW(OLD.customer_visible,OLD.customer_room,OLD.customer_order,OLD.customer_category,OLD.customer_name,OLD.customer_size,OLD.customer_disposal_allowed,OLD.customer_only,OLD.customer_key,OLD.customer_deleted_at) THEN RAISE EXCEPTION 'Customer catalog requires platform administrator'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_customer_catalog_settings BEFORE INSERT OR UPDATE ON public.item_icons FOR EACH ROW EXECUTE FUNCTION public.guard_customer_catalog_settings();
COMMENT ON COLUMN public.item_icons.customer_only IS 'Customer intake catalog only; exclude from ordinary company catalog. Never hard-delete referenced rows or images.';
COMMENT ON COLUMN public.item_icons.customer_name IS 'Customer-only display name; ordinary estimate display_name is unchanged.';
COMMENT ON COLUMN public.profiles.intake_item_settings IS 'DEPRECATED: new customer catalog edits use item_icons customer_* settings. Legacy per-company hidden cards remain readable.';