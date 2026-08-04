create table if not exists public.neutral_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  last_provider text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dreem_school_memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  profile_id uuid not null references public.neutral_profiles(id) on delete cascade,
  legacy_profile_id uuid references public.profiles(id) on delete set null,
  role text not null check (
    role in ('leadership', 'teacher', 'student', 'parent', 'bursar', 'transport', 'support')
  ),
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'suspended', 'revoked')
  ),
  department text not null default '',
  matricule text not null,
  approved_by uuid references public.neutral_profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, profile_id),
  unique (school_id, matricule)
);

create index if not exists dreem_school_memberships_profile_idx
on public.dreem_school_memberships (profile_id, status);

create index if not exists dreem_school_memberships_school_status_idx
on public.dreem_school_memberships (school_id, status, role);

insert into public.neutral_profiles (id, full_name, email, last_provider)
select p.id, p.full_name, u.email, 'legacy-profile'
from public.profiles p
join auth.users u on u.id = p.id
on conflict (id) do update
set full_name = excluded.full_name,
    email = excluded.email,
    updated_at = now();

insert into public.dreem_school_memberships (
  school_id,
  profile_id,
  legacy_profile_id,
  role,
  status,
  department,
  matricule,
  approved_by,
  approved_at
)
select
  p.school_id,
  p.id,
  p.id,
  p.role,
  'approved',
  p.department,
  p.matricule,
  null,
  p.created_at
from public.profiles p
join public.neutral_profiles np on np.id = p.id
on conflict (school_id, profile_id) do update
set legacy_profile_id = excluded.legacy_profile_id,
    role = excluded.role,
    status = excluded.status,
    department = excluded.department,
    matricule = excluded.matricule,
    updated_at = now();

alter table public.neutral_profiles enable row level security;
alter table public.dreem_school_memberships enable row level security;

revoke all on public.neutral_profiles from authenticated;
revoke all on public.dreem_school_memberships from authenticated;
grant select, insert, update on public.neutral_profiles to authenticated;
grant select, insert, update on public.dreem_school_memberships to authenticated;

drop policy if exists "Neutral profile owner can read own profile" on public.neutral_profiles;
create policy "Neutral profile owner can read own profile"
on public.neutral_profiles
for select
to authenticated
using (id = (select auth.uid()));

drop policy if exists "Neutral profile owner can insert own profile" on public.neutral_profiles;
create policy "Neutral profile owner can insert own profile"
on public.neutral_profiles
for insert
to authenticated
with check (id = (select auth.uid()));

drop policy if exists "Neutral profile owner can update own profile" on public.neutral_profiles;
create policy "Neutral profile owner can update own profile"
on public.neutral_profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "DREEM memberships visible to self and same school operators"
on public.dreem_school_memberships;
create policy "DREEM memberships visible to self and same school operators"
on public.dreem_school_memberships
for select
to authenticated
using (
  profile_id = (select auth.uid())
  or school_id in (
    select p.school_id
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('leadership', 'support')
  )
);

drop policy if exists "DREEM memberships inserted by school operators"
on public.dreem_school_memberships;
create policy "DREEM memberships inserted by school operators"
on public.dreem_school_memberships
for insert
to authenticated
with check (
  school_id in (
    select p.school_id
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('leadership', 'support')
  )
);

drop policy if exists "DREEM memberships updated by school operators"
on public.dreem_school_memberships;
create policy "DREEM memberships updated by school operators"
on public.dreem_school_memberships
for update
to authenticated
using (
  school_id in (
    select p.school_id
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('leadership', 'support')
  )
)
with check (
  school_id in (
    select p.school_id
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('leadership', 'support')
  )
);

create or replace function public.current_profile_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select m.school_id
      from public.dreem_school_memberships m
      where m.profile_id = (select auth.uid())
        and m.status = 'approved'
      order by m.created_at asc
      limit 1
    ),
    (
      select p.school_id
      from public.profiles p
      where p.id = (select auth.uid())
      limit 1
    )
  )
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select m.role
      from public.dreem_school_memberships m
      where m.profile_id = (select auth.uid())
        and m.status = 'approved'
      order by m.created_at asc
      limit 1
    ),
    (
      select p.role
      from public.profiles p
      where p.id = (select auth.uid())
      limit 1
    )
  )
$$;

create or replace function public.current_dreem_membership_status()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select m.status
      from public.dreem_school_memberships m
      where m.profile_id = (select auth.uid())
      order by m.created_at asc
      limit 1
    ),
    'none'
  )
$$;

revoke execute on function public.current_profile_school_id() from public;
revoke execute on function public.current_profile_role() from public;
revoke execute on function public.current_dreem_membership_status() from public;
grant execute on function public.current_profile_school_id() to authenticated;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.current_dreem_membership_status() to authenticated;
