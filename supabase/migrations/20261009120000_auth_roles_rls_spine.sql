-- Phase 1: auth, roles and the RLS spine.
--
-- Guardrail §3.3: every table in public has RLS enabled with explicit policies.
-- There is no table whose default is open.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('patient', 'pharmacist', 'branch_admin', 'superadmin');

-- Roles live in their own table, never as a column on profiles. A policy on
-- profiles that reads a role from profiles recurses; Postgres detects it and
-- errors at query time, which is a bad way to find out.
create table public.user_roles (
  user_id uuid not null references auth.users on delete cascade,
  role    public.app_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users,
  primary key (user_id, role)
);

-- SECURITY DEFINER so the function reads user_roles with the definer's rights,
-- breaking the recursion. search_path is pinned empty so a caller cannot shadow
-- public with a schema of their own and have this resolve somewhere unintended.
create or replace function public.has_role(_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = _role
  );
$fn$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role in ('pharmacist', 'branch_admin', 'superadmin')
  );
$fn$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  full_name  text,
  phone      text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Consent (Data Protection Act 2019: granular, versioned, revocable)
-- ---------------------------------------------------------------------------

create table public.consents (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  purpose    text not null,
  version    text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index consents_user_idx on public.consents (user_id);

-- ---------------------------------------------------------------------------
-- Audit log (§3.5: every read of PHI by a non-owner lands here)
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users,
  action      text not null,
  entity      text not null,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  occurred_at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity, entity_id);
create index audit_log_actor_idx on public.audit_log (actor_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.user_roles enable row level security;
alter table public.profiles   enable row level security;
alter table public.consents   enable row level security;
alter table public.audit_log  enable row level security;

-- A table owner bypasses its own RLS unless forced. The migration runs as owner,
-- so without FORCE the policies would look correct and never actually apply to
-- anything the owner does.
alter table public.user_roles force row level security;
alter table public.profiles   force row level security;
alter table public.consents   force row level security;
alter table public.audit_log  force row level security;

-- user_roles: readable by the holder and by staff. Writable only by superadmin —
-- self-granting a role would defeat every other policy in this file.
create policy user_roles_select_own on public.user_roles
  for select using ((select auth.uid()) = user_id or public.is_staff());

create policy user_roles_write_superadmin on public.user_roles
  for all
  using (public.has_role('superadmin'))
  with check (public.has_role('superadmin'));

-- profiles: your own row, plus staff read for dispensing.
create policy profiles_select_own on public.profiles
  for select using ((select auth.uid()) = id or public.is_staff());

create policy profiles_insert_own on public.profiles
  for insert with check ((select auth.uid()) = id);

-- WITH CHECK as well as USING: without it a user could update their row to set
-- id to someone else's and hand their profile away.
create policy profiles_update_own on public.profiles
  for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- consents: strictly the data subject's own.
create policy consents_select_own on public.consents
  for select using ((select auth.uid()) = user_id);

create policy consents_insert_own on public.consents
  for insert with check ((select auth.uid()) = user_id);

create policy consents_update_own on public.consents
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- audit_log: append-only from the application's point of view. No update or
-- delete policy exists, so neither is permitted for anyone but the service role.
-- An audit trail that its subject can edit is not an audit trail.
create policy audit_log_insert on public.audit_log
  for insert with check (true);

create policy audit_log_select_staff on public.audit_log
  for select using (public.is_staff());

-- ---------------------------------------------------------------------------
-- New users get a profile and the patient role automatically.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.phone
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'patient')
  on conflict do nothing;

  return new;
end;
$fn$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
