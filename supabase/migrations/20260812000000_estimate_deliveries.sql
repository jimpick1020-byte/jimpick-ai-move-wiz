-- 견적서 문자 발송 이력
--
-- 기존 테이블(profiles, payments, subscriptions, user_roles)은 건드리지 않습니다.
-- 이 파일은 새 테이블 하나만 추가합니다.

create table if not exists public.estimate_deliveries (
  id uuid primary key default gen_random_uuid(),

  -- 어떤 견적서를 보냈는지
  estimate_id text,
  sheet_no text,

  -- 누구 것인지 (업체·사용자별로 갈라 보기 위해)
  user_id uuid references auth.users (id) on delete set null,
  company_id uuid,

  -- 받는 번호는 뒤 4자리만 남깁니다 (전체 번호를 저장하지 않습니다)
  to_masked text not null,

  msg_type text,          -- SMS · LMS · MMS
  msg_id text,            -- 알리고가 준 발송번호
  status text not null,   -- success · failed
  error_message text,
  test_mode boolean not null default false,

  -- 같은 발송을 두 번 하지 않도록 하는 열쇠
  idempotency_key text,

  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 같은 열쇠로는 성공 기록이 하나만 남게 합니다 (중복 발송 방지)
create unique index if not exists estimate_deliveries_idem_success_idx
  on public.estimate_deliveries (idempotency_key)
  where status = 'success' and idempotency_key is not null;

create index if not exists estimate_deliveries_user_idx
  on public.estimate_deliveries (user_id, sent_at desc);

create index if not exists estimate_deliveries_sheet_idx
  on public.estimate_deliveries (sheet_no);

-- 보안: 내 것만 보이게 합니다
alter table public.estimate_deliveries enable row level security;

-- 사용자는 자기 발송 내역만 읽습니다
drop policy if exists "own deliveries readable" on public.estimate_deliveries;
create policy "own deliveries readable"
  on public.estimate_deliveries
  for select
  using (auth.uid() = user_id);

-- 기록은 중계 서버(service_role)만 남깁니다.
-- service_role 은 RLS 를 지나가므로 따로 정책을 두지 않습니다.
-- 즉, 앱에서 직접 이 표에 넣거나 고칠 수 없습니다.
