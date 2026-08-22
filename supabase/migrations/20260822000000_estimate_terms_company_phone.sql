-- 문자 끝에 넣을 업체 연락처를 함께 보관합니다.
--
-- contact_phone 은 고객이 받는 번호이고,
-- company_phone 은 문자에 적히는 「문의:」 번호입니다.
-- 이미 있는 표에 칸 하나만 더합니다.
ALTER TABLE public.estimate_terms
  ADD COLUMN IF NOT EXISTS company_phone text;

COMMENT ON COLUMN public.estimate_terms.company_phone IS '문자에 적는 업체 연락처 (문의처)';
