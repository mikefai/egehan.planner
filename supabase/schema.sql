-- ============================================================
-- SAT Planner & Tracker — Supabase schema (free tier)
-- Run this entire file in: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'student' check (role in ('admin','student')),
  display_name text,
  created_at timestamptz default now()
);

-- bootstrap: first-ever signup becomes admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, role, display_name)
  values (
    new.id,
    new.email,
    case when not exists (select 1 from public.profiles where role = 'admin') then 'admin' else 'student' end,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- homework ----------
create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text default 'sat',
  priority text default 'med' check (priority in ('high','med','low')),
  due_date date,
  assigned_to uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'assigned' check (status in ('assigned','submitted','graded')),
  submission_note text,
  submitted_at timestamptz,
  grade numeric,
  feedback text,
  graded_at timestamptz,
  graded_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.homework_attachments (
  id uuid primary key default gen_random_uuid(),
  homework_id uuid not null references public.homework(id) on delete cascade,
  name text not null,
  url text not null,
  file_type text default 'link' check (file_type in ('link','pdf','video','doc','image','other')),
  storage_path text,
  created_at timestamptz default now()
);

-- ---------- student logs ----------
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  start_time text,
  end_time text,
  hours numeric not null default 0,
  subject text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  total int not null,
  math int,
  rw int,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category text,
  status text default 'Planning',
  target_hours numeric default 0,
  progress int default 0,
  description text,
  created_at timestamptz default now()
);

create table if not exists public.port_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  hours numeric not null default 0,
  project text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  due_date date,
  priority text default 'med' check (priority in ('high','med','low')),
  done boolean default false,
  created_at timestamptz default now()
);

-- ---------- notifications (in-app only) ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean default false,
  created_at timestamptz default now()
);

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.homework enable row level security;
alter table public.homework_attachments enable row level security;
alter table public.study_sessions enable row level security;
alter table public.scores enable row level security;
alter table public.projects enable row level security;
alter table public.port_sessions enable row level security;
alter table public.goals enable row level security;
alter table public.notifications enable row level security;

-- helper: is current user admin?
create or replace function public.is_admin() returns boolean language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- profiles
create policy "profiles_select_own_or_admin" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid());

-- homework: admin full; student read assigned, update status/submission
create policy "homework_admin_all" on public.homework for all
  using (public.is_admin()) with check (public.is_admin());
create policy "homework_student_select" on public.homework for select
  using (assigned_to = auth.uid());
create policy "homework_student_submit" on public.homework for update
  using (assigned_to = auth.uid())
  with check (assigned_to = auth.uid());

-- attachments: admin full; student read if homework assigned to them
create policy "attachments_admin_all" on public.homework_attachments for all
  using (public.is_admin()) with check (public.is_admin());
create policy "attachments_student_select" on public.homework_attachments for select
  using (exists (select 1 from public.homework h where h.id = homework_id and h.assigned_to = auth.uid()));

-- student logs: admin full; student own rows
create policy "study_admin_all" on public.study_sessions for all
  using (public.is_admin()) with check (public.is_admin());
create policy "study_student_own" on public.study_sessions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "scores_admin_all" on public.scores for all
  using (public.is_admin()) with check (public.is_admin());
create policy "scores_student_own" on public.scores for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "projects_admin_all" on public.projects for all
  using (public.is_admin()) with check (public.is_admin());
create policy "projects_student_own" on public.projects for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "portsessions_admin_all" on public.port_sessions for all
  using (public.is_admin()) with check (public.is_admin());
create policy "portsessions_student_own" on public.port_sessions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "goals_admin_all" on public.goals for all
  using (public.is_admin()) with check (public.is_admin());
create policy "goals_student_own" on public.goals for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- notifications: admin can create for anyone; user reads/updates own
create policy "notif_admin_insert" on public.notifications for insert
  with check (public.is_admin());
create policy "notif_own_select" on public.notifications for select
  using (user_id = auth.uid());
create policy "notif_own_update" on public.notifications for update
  using (user_id = auth.uid());

-- ---------- realtime ----------
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.homework;
alter publication supabase_realtime add table public.study_sessions;
alter publication supabase_realtime add table public.scores;

-- ---------- storage bucket for file uploads (optional, free 1GB) ----------
insert into storage.buckets (id, name, public) values ('homework-files','homework-files',true)
on conflict (id) do nothing;

create policy "storage_admin_upload" on storage.objects for insert
  with check (bucket_id = 'homework-files' and public.is_admin());
create policy "storage_public_read" on storage.objects for select
  using (bucket_id = 'homework-files');
create policy "storage_admin_delete" on storage.objects for delete
  using (bucket_id = 'homework-files' and public.is_admin());

-- ============================================================
-- v9 additions: goals.category, error_log, sessions_1on1
-- ============================================================
alter table public.goals add column if not exists category text not null default 'realistic';

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

alter table public.error_log enable row level security;
alter table public.sessions_1on1 enable row level security;

drop policy if exists "errorlog_admin_all" on public.error_log;
drop policy if exists "errorlog_student_own" on public.error_log;
create policy "errorlog_admin_all" on public.error_log for all
  using (public.is_admin()) with check (public.is_admin());
create policy "errorlog_student_own" on public.error_log for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "sessions_teacher_all" on public.sessions_1on1;
drop policy if exists "sessions_student_select" on public.sessions_1on1;
drop policy if exists "sessions_student_update" on public.sessions_1on1;
create policy "sessions_teacher_all" on public.sessions_1on1 for all
  using (public.is_admin()) with check (public.is_admin());
create policy "sessions_student_select" on public.sessions_1on1 for select
  using (student_id = auth.uid());
create policy "sessions_student_update" on public.sessions_1on1 for update
  using (student_id = auth.uid()) with check (student_id = auth.uid());

do $$ begin
  alter publication supabase_realtime add table public.sessions_1on1;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.error_log;
exception when duplicate_object then null; end $$;
