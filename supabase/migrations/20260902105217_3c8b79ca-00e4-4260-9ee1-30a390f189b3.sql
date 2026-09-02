create table if not exists public.estimate_deliveries (
  id uuid primary key default gen_random_uuid(),
  estimate_id text,
  sheet_no text,
  user_id uuid references auth.users (id) on delete set null,
  company_id uuid,
  to_masked text not null,
  msg_type text,
  msg_id text,
  status text not null,
  error_message text,
  test_mode boolean not null default false,
  idempotency_key text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.estimate_deliveries
  add column if not exists estimate_version integer,
  add column if not exists delivery_method text not null default 'link',
  add column if not exists provider text not null default 'aligo',
  add column if not exists provider_message_id text,
  add column if not exists requested_at timestamptz not null default now(),
  add column if not exists failed_at timestamptz,
  add column if not exists error_code text,
  add column if not exists provider_result jsonb;

create unique index if not exists estimate_deliveries_idem_success_idx
  on public.estimate_deliveries (idempotency_key)
  where status = 'success' and idempotency_key is not null;

create unique index if not exists estimate_deliveries_once_idx
  on public.estimate_deliveries (estimate_id, estimate_version, idempotency_key)
  where status in ('queued', 'sent') and idempotency_key is not null;

create index if not exists estimate_deliveries_user_idx
  on public.estimate_deliveries (user_id, sent_at desc);

create index if not exists estimate_deliveries_sheet_idx
  on public.estimate_deliveries (sheet_no);

grant select on public.estimate_deliveries to authenticated;
grant all on public.estimate_deliveries to service_role;

alter table public.estimate_deliveries enable row level security;

drop policy if exists "own deliveries readable" on public.estimate_deliveries;
create policy "own deliveries readable"
  on public.estimate_deliveries
  for select
  to authenticated
  using (auth.uid() = user_id);