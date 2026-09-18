ALTER TABLE public.item_icons
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS normalized_name text,
  ADD COLUMN IF NOT EXISTS category_group text,
  ADD COLUMN IF NOT EXISTS subcategory_group text,
  ADD COLUMN IF NOT EXISTS size_label text NOT NULL DEFAULT '소형',
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS generation_id text,
  ADD COLUMN IF NOT EXISTS is_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_name text,
  ADD COLUMN IF NOT EXISTS requested_name text,
  ADD COLUMN IF NOT EXISTS generation_prompt text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

WITH recovered AS (
  SELECT id,
    CASE
      WHEN prompt IS NOT NULL AND prompt ~ 'Korean household moving item: "[^"]*[가-힣][^"]*"'
        THEN (regexp_match(prompt, 'Korean household moving item: "([^"]*[가-힣][^"]*)"'))[1]
      WHEN name ~ '[가-힣]' AND name !~* '(^ci_ai_|^ai_|^generated_|^[0-9a-f]{8}-[0-9a-f-]{27,}$|\.(png|jpe?g|webp|gif)$|/)' THEN name
      ELSE NULL
    END AS recovered_name
  FROM public.item_icons
)
UPDATE public.item_icons AS i
SET display_name = COALESCE(i.display_name, r.recovered_name, '이름 수정 필요'),
    normalized_name = COALESCE(i.normalized_name, i.norm_name),
    category_group = COALESCE(i.category_group, i.cat),
    storage_path = COALESCE(i.storage_path, i.image_path),
    generation_id = COALESCE(i.generation_id, CASE WHEN i.item_id LIKE 'ci_ai_%' THEN i.item_id END),
    is_generated = i.is_generated OR i.item_id LIKE 'ci_ai_%',
    original_name = COALESCE(i.original_name, r.recovered_name),
    requested_name = COALESCE(i.requested_name, r.recovered_name),
    generation_prompt = COALESCE(i.generation_prompt, i.prompt),
    metadata = COALESCE(i.metadata, '{}'::jsonb)
FROM recovered AS r
WHERE r.id = i.id;

ALTER TABLE public.item_icons
  ALTER COLUMN display_name SET NOT NULL,
  ALTER COLUMN normalized_name SET NOT NULL,
  ALTER COLUMN category_group SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS item_icons_user_normalized_name_uniq
  ON public.item_icons (user_id, normalized_name) WHERE active;

CREATE INDEX IF NOT EXISTS item_icons_user_group_sort_idx
  ON public.item_icons (user_id, category_group, subcategory_group, sort_order, created_at DESC)
  WHERE active;

ALTER TABLE public.item_icons
  DROP CONSTRAINT IF EXISTS item_icons_size_label_check;
ALTER TABLE public.item_icons
  ADD CONSTRAINT item_icons_size_label_check CHECK (size_label IN ('소형', '중형', '대형'));

COMMENT ON COLUMN public.item_icons.display_name IS '사용자에게 표시할 품목명. 내부 ID나 저장 경로를 대체값으로 사용하지 않는다.';
COMMENT ON COLUMN public.item_icons.normalized_name IS '중복 검사에 사용하는 정규화 품목명';
COMMENT ON COLUMN public.item_icons.storage_path IS '비공개 저장소 내부 이미지 경로';
COMMENT ON COLUMN public.item_icons.generation_id IS '이미지 생성 작업 식별값';