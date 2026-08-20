-- 고객이 문자로 받아 보는 견적서 원본을 함께 저장합니다.
--
-- 지금까지는 고객 화면에 이름·이사일·금액만 보였습니다.
-- 사장님 화면과 똑같은 견적서(공간별 품목·비용 상세까지)를 보여 주려면
-- 보낼 때의 견적서 내용을 그대로 담아 두어야 합니다.
--
-- 이미 있는 표에 칸 하나만 더합니다. 새 표를 만들지 않고, 기존 자료도 그대로 둡니다.
ALTER TABLE public.estimate_terms
  ADD COLUMN IF NOT EXISTS sheet_snapshot text;

COMMENT ON COLUMN public.estimate_terms.sheet_snapshot IS '보낼 때의 견적서 원본 (고객 화면에 그대로 보여 줍니다)';
