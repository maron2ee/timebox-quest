-- ============================================================
-- TIMEBOX QUEST — Supabase 테이블 + 보안정책(RLS)
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 RUN 하세요.
-- ============================================================

create table if not exists public.user_state (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

-- 본인 데이터만 읽고/쓸 수 있게
drop policy if exists "own state select" on public.user_state;
drop policy if exists "own state upsert" on public.user_state;
drop policy if exists "own state update" on public.user_state;

create policy "own state select" on public.user_state
  for select using (auth.uid() = user_id);

create policy "own state upsert" on public.user_state
  for insert with check (auth.uid() = user_id);

create policy "own state update" on public.user_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
