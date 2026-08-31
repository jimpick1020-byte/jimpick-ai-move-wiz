-- 사업자 정보 확장 + 사업자등록증 비공개 Storage.
--
-- 안전 원칙:
--  * 기존 profiles 테이블을 "확장"만 합니다(컬럼 추가). 어떤 행도 삭제/초기화하지 않습니다.
--  * 사용자/고객/견적/품목/주소/금액/문자발송 데이터는 전혀 건드리지 않습니다.
--  * 모든 구문은 IF NOT EXISTS / ON CONFLICT / DROP POLICY IF EXISTS 로 재실행해도 안전합니다.

-- 1) profiles 에 사업자등록번호·등록증 경로 컬럼 추가 (사장님 계정별, id = auth.uid)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_number text,
  ADD COLUMN IF NOT EXISTS cert_path text;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- profiles 의 소유자 전용 RLS(select/insert/update own)는 기존 마이그레이션에 이미 있으므로
-- 새 컬럼도 그 정책의 보호를 그대로 받습니다(다른 업체가 볼 수 없음).

-- 2) 사업자등록증 비공개 버킷.
--    - public=false → 공개 URL 로 노출되지 않습니다(조회는 서명 URL 로만).
--    - 10MB 제한, JPG/PNG/PDF 만 허용.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-docs',
  'business-docs',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3) Storage RLS — 로그인한 본인(auth.uid)만 자신의 폴더(<uid>/...) 파일을
--    조회·업로드·교체·삭제할 수 있습니다. 파일 경로 규칙: "<user_id>/<파일명>".
DROP POLICY IF EXISTS "business_docs_select_own" ON storage.objects;
CREATE POLICY "business_docs_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'business-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "business_docs_insert_own" ON storage.objects;
CREATE POLICY "business_docs_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'business-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "business_docs_update_own" ON storage.objects;
CREATE POLICY "business_docs_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'business-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'business-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "business_docs_delete_own" ON storage.objects;
CREATE POLICY "business_docs_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'business-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
