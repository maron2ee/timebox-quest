-- ===========================================================
-- supabase.sql — 하루 계획: 기기 간 동기화용 테이블
-- 본인 소유의 무료 Supabase 프로젝트에서 SQL Editor 로 한 번만 실행하세요.
-- 사용자 1명당 데이터 전체(jsonb 1개)를 저장 — RLS 로 본인 행만 읽고/쓸 수 있다.
-- ===========================================================

create table if not exists public.user_state (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

create policy "own state select" on public.user_state
  for select using (auth.uid() = user_id);

create policy "own state insert" on public.user_state
  for insert with check (auth.uid() = user_id);

create policy "own state update" on public.user_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
