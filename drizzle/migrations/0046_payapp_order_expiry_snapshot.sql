ALTER TABLE public.payapp_orders ADD COLUMN request_date date;
ALTER TABLE public.payapp_orders ADD COLUMN rebill_expire date;
-- No backfill: historical orders retain their original provider contract.
ALTER TABLE public.payapp_orders ALTER COLUMN request_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Seoul')::date);
ALTER TABLE public.payapp_orders ALTER COLUMN rebill_expire SET DEFAULT ((((now() AT TIME ZONE 'Asia/Seoul')::date)+interval '5 years')::date);
COMMENT ON COLUMN public.payapp_orders.rebill_expire IS 'Exclusive provider registration expiry, snapshotted for new orders only; not a prepaid term.';
CREATE OR REPLACE FUNCTION public.check_payapp_expiry_notice() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE expires date;
BEGIN
 IF NEW.pay_state='4' THEN
  SELECT rebill_expire INTO expires FROM public.payapp_orders WHERE id=NEW.order_id;
  IF expires IS NOT NULL AND (NEW.paid_at AT TIME ZONE 'Asia/Seoul')::date>=expires THEN RAISE EXCEPTION 'Approval at or after registration expiry requires reconciliation'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER payapp_expiry_notice BEFORE INSERT ON public.payapp_notice_audit FOR EACH ROW EXECUTE FUNCTION public.check_payapp_expiry_notice();