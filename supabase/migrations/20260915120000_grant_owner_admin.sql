-- 서비스 소유자(관리자) 계정에 admin 역할을 부여합니다.
--
--  · admin 계정은 무료체험 배너가 표시되지 않고, 기간 제한 없이 모든 기능을 씁니다.
--    (entitlement 계산에서 admin 상태 → allowed=true, 화면의 "7일 무료체험" 배너는 trial 상태에서만 표시)
--  · 다른 업체 계정·구독·견적·문자발송 데이터는 전혀 건드리지 않습니다.
--  · 이미 admin 이면 아무 것도 하지 않습니다(반복 실행 안전).
insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
from auth.users u
where lower(u.email) = lower('hinaka27@naver.com')
  and not exists (
    select 1
    from public.user_roles r
    where r.user_id = u.id
      and r.role = 'admin'
  );
