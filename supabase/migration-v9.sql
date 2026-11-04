-- ============================================================
-- Migration v9: goals.category, error_log, sessions_1on1
-- Safe to run multiple times. Run in Supabase SQL Editor.
-- (Adds to the existing project without dropping data.)
-- ============================================================

-- goals gain a category (realistic | dreamy)
alter table public.goals add column if not exists category text not null default 'realistic';

-- ---------- error log (weak-point tracker) ----------
create table if not exists public.error_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  subject text not null,
  topic text not null,
  description text,
  status text not null default 'weak' check (status in ('weak','improving','mastered')),
  notes text,
  created_at timestamptz default now()
);

-- ---------- 1:1 sessions (teacher proposes, learner confirms) ----------
create table if not exists public.sessions_1on1 (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  start_time text,
  end_time text,
  topic text not null,
  notes text,
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'proposed' check (status in ('proposed','confirmed','cancelled')),
  proposed_at timestamptz default now(),
  confirmed_at timestamptz,
  created_at timestamptz default now()
);

-- ---------- RLS ----------
alter table public.error_log enable row level security;
alter table public.sessions_1on1 enable row level security;

-- error_log: admin full, learner own
drop policy if exists "errorlog_admin_all" on public.error_log;
drop policy if exists "errorlog_student_own" on public.error_log;
create policy "errorlog_admin_all" on public.error_log for all
  using (public.is_admin()) with check (public.is_admin());
create policy "errorlog_student_own" on public.error_log for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- sessions_1on1: teacher full; learner reads own + confirms own
drop policy if exists "sessions_teacher_all" on public.sessions_1on1;
drop policy if exists "sessions_student_select" on public.sessions_1on1;
drop policy if exists "sessions_student_update" on public.sessions_1on1;
create policy "sessions_teacher_all" on public.sessions_1on1 for all
  using (public.is_admin()) with check (public.is_admin());
create policy "sessions_student_select" on public.sessions_1on1 for select
  using (student_id = auth.uid());
create policy "sessions_student_update" on public.sessions_1on1 for update
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ---------- realtime ----------
do $$ begin
  alter publication supabase_realtime add table public.sessions_1on1;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.error_log;
exception when duplicate_object then null; end $$;
