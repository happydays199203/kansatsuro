-- 観察録 v2: アカウント作成 + 共有チーム対応 Supabase schema
-- Supabase SQL Editor に貼り付けて実行してください。

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '観察者',
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default '観察チーム',
  invite_code text not null unique default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  created_by uuid references auth.users(id) on delete set null,
  public_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.observations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  title text not null,
  category text not null default '苗',
  status text not null default 'ok' check (status in ('ok', 'needs_check')),
  image_url text,
  observed_at timestamptz not null default now(),
  location text,
  weather text default '晴れ',
  temperature integer default 18,
  memo text,
  hypothesis text,
  question text,
  tags text[] default '{}',
  owner_name text default '観察者',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.observations add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.observations add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.observations add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_workspace_members_user on public.workspace_members(user_id);
create index if not exists idx_workspace_members_workspace on public.workspace_members(workspace_id);
create index if not exists idx_observations_workspace_observed on public.observations(workspace_id, observed_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists workspaces_touch_updated_at on public.workspaces;
create trigger workspaces_touch_updated_at before update on public.workspaces for each row execute function public.touch_updated_at();
drop trigger if exists observations_touch_updated_at on public.observations;
create trigger observations_touch_updated_at before update on public.observations for each row execute function public.touch_updated_at();

-- RLS再帰を避けるための補助関数
create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id and wm.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id and wm.user_id = auth.uid() and wm.role = 'owner'
  );
$$;

create or replace function public.create_workspace(p_name text)
returns public.workspaces language plpgsql security definer set search_path = public as $$
declare new_workspace public.workspaces;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  insert into public.workspaces (name, created_by)
  values (coalesce(nullif(trim(p_name), ''), '観察チーム'), auth.uid())
  returning * into new_workspace;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace.id, auth.uid(), 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return new_workspace;
end;
$$;

create or replace function public.join_workspace(p_invite_code text)
returns public.workspaces language plpgsql security definer set search_path = public as $$
declare target_workspace public.workspaces;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  select * into target_workspace from public.workspaces where invite_code = lower(trim(p_invite_code)) limit 1;
  if target_workspace.id is null then raise exception 'workspace not found'; end if;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (target_workspace.id, auth.uid(), 'member')
  on conflict (workspace_id, user_id) do nothing;
  return target_workspace;
end;
$$;

grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.join_workspace(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.observations enable row level security;

drop policy if exists "Anyone can read observations" on public.observations;
drop policy if exists "Anyone can insert observations" on public.observations;
drop policy if exists "Authenticated users can read own profile" on public.profiles;
drop policy if exists "Authenticated users can insert own profile" on public.profiles;
drop policy if exists "Authenticated users can update own profile" on public.profiles;
drop policy if exists "Members can read workspaces" on public.workspaces;
drop policy if exists "Owners can update workspaces" on public.workspaces;
drop policy if exists "Members can read workspace members" on public.workspace_members;
drop policy if exists "Members can read observations" on public.observations;
drop policy if exists "Members can insert observations" on public.observations;
drop policy if exists "Owners or authors can update observations" on public.observations;
drop policy if exists "Owners or authors can delete observations" on public.observations;

create policy "Authenticated users can read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Authenticated users can insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "Authenticated users can update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Members can read workspaces" on public.workspaces for select to authenticated using (public.is_workspace_member(id));
create policy "Owners can update workspaces" on public.workspaces for update to authenticated using (public.is_workspace_owner(id)) with check (public.is_workspace_owner(id));

create policy "Members can read workspace members" on public.workspace_members for select to authenticated using (user_id = auth.uid() or public.is_workspace_owner(workspace_id));

create policy "Members can read observations" on public.observations for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Members can insert observations" on public.observations for insert to authenticated with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());
create policy "Owners or authors can update observations" on public.observations for update to authenticated using (user_id = auth.uid() or public.is_workspace_owner(workspace_id)) with check (user_id = auth.uid() or public.is_workspace_owner(workspace_id));
create policy "Owners or authors can delete observations" on public.observations for delete to authenticated using (user_id = auth.uid() or public.is_workspace_owner(workspace_id));

-- 写真保存用。URLで表示しやすいようPublic bucketにします。
insert into storage.buckets (id, name, public)
values ('observation-photos', 'observation-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone can read observation photos" on storage.objects;
drop policy if exists "Anyone can upload observation photos" on storage.objects;
drop policy if exists "Public can read observation photos" on storage.objects;
drop policy if exists "Authenticated can upload observation photos" on storage.objects;

create policy "Public can read observation photos" on storage.objects for select using (bucket_id = 'observation-photos');
create policy "Authenticated can upload observation photos" on storage.objects for insert to authenticated with check (bucket_id = 'observation-photos');

-- Realtime反映用：他メンバーの投稿を自動反映したい場合に必要です。
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'observations'
     ) then
    execute 'alter publication supabase_realtime add table public.observations';
  end if;
end $$;
