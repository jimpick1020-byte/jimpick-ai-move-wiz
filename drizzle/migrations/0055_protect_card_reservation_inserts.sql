CREATE OR REPLACE FUNCTION public.guard_card_reservation_insert() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.reservation_payment_choice IS NOT NULL OR NEW.card_requested_at IS NOT NULL OR NEW.card_confirmed_at IS NOT NULL OR NEW.card_confirmed_by IS NOT NULL THEN RAISE EXCEPTION 'Use card reservation RPC'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_card_reservation_insert BEFORE INSERT ON public.estimate_terms FOR EACH ROW EXECUTE FUNCTION public.guard_card_reservation_insert();
CREATE OR REPLACE FUNCTION public.guard_card_request_receipts() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.reservation_payment_choice='onsite_card' AND OLD.reservation_payment_choice IS DISTINCT FROM 'onsite_card' AND EXISTS(SELECT 1 FROM public.deposit_records WHERE user_id=NEW.user_id AND estimate_id=NEW.estimate_id AND status IN ('pending_review','confirmed') AND amount>0) THEN RAISE EXCEPTION 'Existing payment evidence requires owner review'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_card_request_receipts BEFORE UPDATE OF reservation_payment_choice ON public.estimate_terms FOR EACH ROW EXECUTE FUNCTION public.guard_card_request_receipts();