-- 로그인 사용자도 접근 규칙 검사를 통과할 수 있도록 관리자 확인 함수 실행 권한을 돌려줍니다.
-- 함수 자체는 남의 계정 권한을 조회하지 못하도록 이미 막혀 있습니다(SECURITY DEFINER + 본인 검사).
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;