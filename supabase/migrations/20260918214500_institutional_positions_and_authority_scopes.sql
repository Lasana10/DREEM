-- DREEM institutional positions and authority scopes
-- Separates human-facing titles from security authority while preserving legacy roles as a compatibility layer.

create table if not exists public.dreem_school_positions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  code text not null,
  title text not null,
  category text not null default 'operations' check (category in ('governance','leadership','academic','finance','operations','support','audit')),
  reports_to_position_id uuid references public.dreem_school_positions(id) on delete set null,
  is_active boolean not null default true,
  created_by uuid references public.neutral_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, code)
);

create table if not exists public.dreem_position_authorities (
  position_id uuid not null references public.dreem_school_positions(id) on delete cascade,
  scope text not null check (scope in (
    'institutional_leadership',
    'academics',
    'admissions',
    'finance_collection',
    'finance_approval',
    'safeguarding',
    'transport',
    'gate',
    'staff_management',
    'communications',
    'audit',
    'school_configuration'
  )),
  created_at timestamptz not null default now(),
  primary key (position_id, scope)
);

create table if not exists public.dreem_position_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  membership_id uuid not null references public.dreem_school_memberships(id) on delete cascade,
  position_id uuid not null references public.dreem_school_positions(id) on delete cascade,
  is_primary boolean not null default false,
  status text not null default 'active' check (status in ('active','suspended','ended')),
  starts_on date,
  ends_on date,
  assigned_by uuid references public.neutral_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (membership_id, position_id)
);

create unique index if not exists dreem_position_assignments_one_primary
on public.dreem_position_assignments (membership_id)
where is_primary and status='active';

create index if not exists dreem_positions_school_idx on public.dreem_school_positions(school_id, is_active);
create index if not exists dreem_position_assignments_school_idx on public.dreem_position_assignments(school_id, status);
create index if not exists dreem_position_assignments_membership_idx on public.dreem_position_assignments(membership_id, status);

alter table public.dreem_school_positions enable row level security;
alter table public.dreem_position_authorities enable row level security;
alter table public.dreem_position_assignments enable row level security;

revoke all on public.dreem_school_positions from anon, authenticated;
revoke all on public.dreem_position_authorities from anon, authenticated;
revoke all on public.dreem_position_assignments from anon, authenticated;
grant select on public.dreem_school_positions to authenticated;
grant select on public.dreem_position_authorities to authenticated;
grant select on public.dreem_position_assignments to authenticated;

drop policy if exists "positions visible in active approved school" on public.dreem_school_positions;
create policy "positions visible in active approved school"
on public.dreem_school_positions for select to authenticated
using (
  exists (
    select 1 from public.dreem_school_memberships m
    where m.school_id=dreem_school_positions.school_id
      and m.profile_id=(select auth.uid())
      and m.status='approved'
  )
);

drop policy if exists "position authorities visible in active approved school" on public.dreem_position_authorities;
create policy "position authorities visible in active approved school"
on public.dreem_position_authorities for select to authenticated
using (
  exists (
    select 1
    from public.dreem_school_positions p
    join public.dreem_school_memberships m on m.school_id=p.school_id
    where p.id=dreem_position_authorities.position_id
      and m.profile_id=(select auth.uid())
      and m.status='approved'
  )
);

drop policy if exists "position assignments visible to self or same school leadership" on public.dreem_position_assignments;
create policy "position assignments visible to self or same school leadership"
on public.dreem_position_assignments for select to authenticated
using (
  exists (
    select 1 from public.dreem_school_memberships own
    where own.id=dreem_position_assignments.membership_id
      and own.profile_id=(select auth.uid())
      and own.status='approved'
  )
  or exists (
    select 1
    from public.dreem_school_memberships viewer
    where viewer.school_id=dreem_position_assignments.school_id
      and viewer.profile_id=(select auth.uid())
      and viewer.status='approved'
      and viewer.role in ('platform_founder','school_owner','principal','administrator')
  )
);

create or replace function private.dreem_legacy_authority_scopes(p_role text)
returns text[]
language sql
immutable
set search_path=''
as $$
  select case p_role
    when 'platform_founder' then array['institutional_leadership','academics_delivery','academics_approval','admissions_intake','admissions_decision','finance_collection','finance_approval','safeguarding','transport_management','transport_operation','gate','staff_management','communications_publish','communications_approve','audit','school_configuration']::text[]
    when 'school_owner' then array['institutional_leadership','academics_approval','admissions_decision','finance_approval','safeguarding','transport_management','staff_management','communications_publish','communications_approve','audit','school_configuration']::text[]
    when 'principal' then array['institutional_leadership','academics_approval','admissions_decision','finance_approval','safeguarding','transport_management','staff_management','communications_publish','communications_approve','school_configuration']::text[]
    when 'administrator' then array['admissions_intake','staff_management','communications_publish','school_configuration']::text[]
    when 'academic_head' then array['academics_approval','admissions_decision','communications_publish']::text[]
    when 'bursar' then array['finance_collection']::text[]
    when 'accountant' then array['finance_approval','audit']::text[]
    when 'teacher' then array['academics_delivery']::text[]
    when 'tutor' then array['academics_delivery']::text[]
    when 'transport_manager' then array['transport_management','communications_publish']::text[]
    when 'driver' then array['transport_operation']::text[]
    when 'security_guard' then array['gate']::text[]
    when 'auditor' then array['audit']::text[]
    else array[]::text[]
  end;
$$;

revoke all on function private.dreem_legacy_authority_scopes(text) from public;
grant execute on function private.dreem_legacy_authority_scopes(text) to authenticated;

create or replace function public.dreem_has_authority(p_school_id uuid, p_scope text)
returns boolean
language sql
stable
security definer
set search_path=''
as $
  with membership as (
    select m.id,m.role
    from public.dreem_school_memberships m
    where m.school_id=p_school_id
      and m.profile_id=(select auth.uid())
      and m.status='approved'
    limit 1
  ),
  explicit_position as (
    select exists(
      select 1
      from membership m
      join public.dreem_position_assignments x on x.membership_id=m.id and x.school_id=p_school_id and x.status='active'
      join public.dreem_school_positions p on p.id=x.position_id and p.is_active
      where p.code not like 'legacy-%'
        and (x.starts_on is null or x.starts_on<=current_date)
        and (x.ends_on is null or x.ends_on>=current_date)
    ) as present
  ),
  assigned as (
    select distinct a.scope
    from membership m
    join public.dreem_position_assignments x on x.membership_id=m.id and x.school_id=p_school_id and x.status='active'
    join public.dreem_school_positions p on p.id=x.position_id and p.is_active
    join public.dreem_position_authorities a on a.position_id=p.id
    cross join explicit_position e
    where (x.starts_on is null or x.starts_on<=current_date)
      and (x.ends_on is null or x.ends_on>=current_date)
      and (not e.present or p.code not like 'legacy-%')
  )
  select exists(select 1 from assigned where scope=p_scope)
    or exists(
      select 1 from membership m cross join explicit_position e
      where not e.present and p_scope=any(private.dreem_legacy_authority_scopes(m.role))
    );
$;

revoke all on function public.dreem_has_authority(uuid,text) from public;
grant execute on function public.dreem_has_authority(uuid,text) to authenticated;

-- Seed neutral default positions for existing operational roles. Schools can rename these without altering permissions.
insert into public.dreem_school_positions(school_id,code,title,category)
select distinct m.school_id,
  'legacy-'||replace(m.role,'_','-'),
  case m.role
    when 'platform_founder' then 'Founder'
    when 'school_owner' then 'Owner / Proprietor'
    when 'principal' then 'Principal'
    when 'administrator' then 'Administrator'
    when 'academic_head' then 'Academic Head'
    when 'bursar' then 'Bursar'
    when 'accountant' then 'Accountant'
    when 'teacher' then 'Teacher'
    when 'tutor' then 'Tutor'
    when 'transport_manager' then 'Transport Manager'
    when 'driver' then 'Driver'
    when 'security_guard' then 'Gate / Security'
    when 'auditor' then 'Auditor'
    else initcap(replace(m.role,'_',' '))
  end,
  case
    when m.role in ('platform_founder','school_owner') then 'governance'
    when m.role='principal' then 'leadership'
    when m.role in ('academic_head','teacher','tutor') then 'academic'
    when m.role in ('bursar','accountant') then 'finance'
    when m.role='auditor' then 'audit'
    else 'operations'
  end
from public.dreem_school_memberships m
where m.status='approved' and m.role not in ('parent','student')
on conflict(school_id,code) do nothing;

insert into public.dreem_position_authorities(position_id,scope)
select p.id,scope
from public.dreem_school_positions p
cross join lateral unnest(
  private.dreem_legacy_authority_scopes(replace(replace(p.code,'legacy-',''),'-','_')::text)
) as scope
where p.code like 'legacy-%'
on conflict do nothing;

-- The role text remains a compatibility/workspace archetype. Primary position is the human-facing appointment.
insert into public.dreem_position_assignments(school_id,membership_id,position_id,is_primary,status)
select m.school_id,m.id,p.id,true,'active'
from public.dreem_school_memberships m
join public.dreem_school_positions p
  on p.school_id=m.school_id
 and p.code='legacy-'||replace(m.role,'_','-')
where m.status='approved' and m.role not in ('parent','student')
on conflict(membership_id,position_id) do nothing;

drop function if exists public.dreem_list_my_school_contexts();
create function public.dreem_list_my_school_contexts()
returns table(
  school_id uuid,
  school_name text,
  role text,
  position_title text,
  authority_scopes text[]
)
language sql
security definer
set search_path=''
as $$
  select
    m.school_id,
    s.name,
    m.role,
    coalesce(primary_position.title, initcap(replace(m.role,'_',' '))) as position_title,
    (
      select coalesce(array_agg(distinct scope order by scope),array[]::text[])
      from (
        select a.scope
        from public.dreem_position_assignments x
        join public.dreem_school_positions p on p.id=x.position_id and p.is_active
        join public.dreem_position_authorities a on a.position_id=p.id
        where x.membership_id=m.id
          and x.school_id=m.school_id
          and x.status='active'
          and (x.starts_on is null or x.starts_on<=current_date)
          and (x.ends_on is null or x.ends_on>=current_date)
          and (
            p.code not like 'legacy-%'
            or not exists(
              select 1
              from public.dreem_position_assignments x2
              join public.dreem_school_positions p2 on p2.id=x2.position_id and p2.is_active
              where x2.membership_id=m.id and x2.school_id=m.school_id and x2.status='active'
                and p2.code not like 'legacy-%'
                and (x2.starts_on is null or x2.starts_on<=current_date)
                and (x2.ends_on is null or x2.ends_on>=current_date)
            )
          )
        union
        select unnest(private.dreem_legacy_authority_scopes(m.role))
        where not exists(
          select 1
          from public.dreem_position_assignments x3
          join public.dreem_school_positions p3 on p3.id=x3.position_id and p3.is_active
          where x3.membership_id=m.id and x3.school_id=m.school_id and x3.status='active'
            and p3.code not like 'legacy-%'
            and (x3.starts_on is null or x3.starts_on<=current_date)
            and (x3.ends_on is null or x3.ends_on>=current_date)
        )
      ) scopes
    ) as authority_scopes
  from public.dreem_school_memberships m
  join public.schools s on s.id=m.school_id
  left join lateral (
    select p.title
    from public.dreem_position_assignments x
    join public.dreem_school_positions p on p.id=x.position_id
    where x.membership_id=m.id and x.status='active'
    order by x.is_primary desc,x.created_at asc
    limit 1
  ) primary_position on true
  where m.profile_id=(select auth.uid()) and m.status='approved'
  order by s.name;
$$;

revoke all on function public.dreem_list_my_school_contexts() from public;
grant execute on function public.dreem_list_my_school_contexts() to authenticated;

create or replace function public.dreem_set_position(
  p_school_id uuid,
  p_membership_id uuid,
  p_title text,
  p_category text,
  p_scopes text[]
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_position_id uuid;
  v_code text;
  v_scope text;
begin
  if not public.dreem_has_authority(p_school_id,'staff_management')
     and not public.dreem_has_authority(p_school_id,'school_configuration') then
    raise exception 'This account cannot manage institutional positions';
  end if;
  if nullif(trim(p_title),'') is null then raise exception 'Position title is required'; end if;
  if p_category not in ('governance','leadership','academic','finance','operations','support','audit') then raise exception 'Invalid position category'; end if;
  if not exists(select 1 from public.dreem_school_memberships m where m.id=p_membership_id and m.school_id=p_school_id and m.status='approved') then
    raise exception 'Approved membership not found in this school';
  end if;

  v_code:='custom-'||replace(p_membership_id::text,'-','');
  insert into public.dreem_school_positions(school_id,code,title,category,created_by)
  values(p_school_id,v_code,trim(p_title),p_category,(select auth.uid()))
  on conflict(school_id,code) do update set title=excluded.title,category=excluded.category,is_active=true,updated_at=now()
  returning id into v_position_id;

  delete from public.dreem_position_authorities where position_id=v_position_id;
  foreach v_scope in array coalesce(p_scopes,array[]::text[]) loop
    if v_scope not in ('institutional_leadership','academics_delivery','academics_approval','admissions_intake','admissions_decision','finance_collection','finance_approval','safeguarding','transport_management','transport_operation','gate','staff_management','communications_publish','communications_approve','audit','school_configuration') then
      raise exception 'Invalid authority scope: %',v_scope;
    end if;
    insert into public.dreem_position_authorities(position_id,scope) values(v_position_id,v_scope) on conflict do nothing;
  end loop;

  update public.dreem_position_assignments
  set is_primary=false,updated_at=now()
  where membership_id=p_membership_id and status='active';

  insert into public.dreem_position_assignments(school_id,membership_id,position_id,is_primary,status,assigned_by)
  values(p_school_id,p_membership_id,v_position_id,true,'active',(select auth.uid()))
  on conflict(membership_id,position_id) do update set is_primary=true,status='active',updated_at=now();

  insert into public.audit_events(school_id,actor_id,action,entity_type,entity_id,detail)
  values(p_school_id,(select auth.uid()),'institution.position_assigned','school_membership',p_membership_id,
    jsonb_build_object('position_id',v_position_id,'title',trim(p_title),'category',p_category,'scopes',coalesce(p_scopes,array[]::text[])));

  return v_position_id;
end;
$$;

revoke all on function public.dreem_set_position(uuid,uuid,text,text,text[]) from public;
grant execute on function public.dreem_set_position(uuid,uuid,text,text,text[]) to authenticated;


-- Reusable institutional position catalogue and assignment commands.
create or replace function public.dreem_upsert_school_position(
  p_school_id uuid,
  p_position_id uuid,
  p_code text,
  p_title text,
  p_category text,
  p_scopes text[]
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_position_id uuid;
  v_scope text;
begin
  if not public.dreem_has_authority(p_school_id,'staff_management')
     and not public.dreem_has_authority(p_school_id,'school_configuration') then
    raise exception 'This account cannot manage institutional positions';
  end if;
  if nullif(trim(p_title),'') is null then raise exception 'Position title is required'; end if;
  if nullif(trim(p_code),'') is null then raise exception 'Position code is required'; end if;
  if p_category not in ('governance','leadership','academic','finance','operations','support','audit') then
    raise exception 'Invalid position category';
  end if;

  if p_position_id is null then
    insert into public.dreem_school_positions(school_id,code,title,category,created_by)
    values(p_school_id,lower(regexp_replace(trim(p_code),'[^a-zA-Z0-9]+','-','g')),trim(p_title),p_category,(select auth.uid()))
    returning id into v_position_id;
  else
    update public.dreem_school_positions
       set code=lower(regexp_replace(trim(p_code),'[^a-zA-Z0-9]+','-','g')),
           title=trim(p_title),
           category=p_category,
           is_active=true,
           updated_at=now()
     where id=p_position_id and school_id=p_school_id
     returning id into v_position_id;
    if v_position_id is null then raise exception 'Position not found in this school'; end if;
  end if;

  delete from public.dreem_position_authorities where position_id=v_position_id;
  foreach v_scope in array coalesce(p_scopes,array[]::text[]) loop
    if v_scope not in ('institutional_leadership','academics_delivery','academics_approval','admissions_intake','admissions_decision','finance_collection','finance_approval','safeguarding','transport_management','transport_operation','gate','staff_management','communications_publish','communications_approve','audit','school_configuration') then
      raise exception 'Invalid authority scope: %',v_scope;
    end if;
    insert into public.dreem_position_authorities(position_id,scope)
    values(v_position_id,v_scope)
    on conflict do nothing;
  end loop;

  insert into public.audit_events(school_id,actor_id,action,entity_type,entity_id,detail)
  values(p_school_id,(select auth.uid()),
    case when p_position_id is null then 'institution.position_created' else 'institution.position_updated' end,
    'school_position',v_position_id,
    jsonb_build_object('title',trim(p_title),'category',p_category,'scopes',coalesce(p_scopes,array[]::text[])));

  return v_position_id;
end;
$$;
revoke all on function public.dreem_upsert_school_position(uuid,uuid,text,text,text,text[]) from public;
grant execute on function public.dreem_upsert_school_position(uuid,uuid,text,text,text,text[]) to authenticated;

create or replace function public.dreem_assign_school_position(
  p_school_id uuid,
  p_membership_id uuid,
  p_position_id uuid,
  p_is_primary boolean default true
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_assignment_id uuid;
begin
  if not public.dreem_has_authority(p_school_id,'staff_management')
     and not public.dreem_has_authority(p_school_id,'school_configuration') then
    raise exception 'This account cannot assign institutional positions';
  end if;
  if not exists(select 1 from public.dreem_school_memberships m where m.id=p_membership_id and m.school_id=p_school_id and m.status='approved') then
    raise exception 'Approved membership not found in this school';
  end if;
  if not exists(select 1 from public.dreem_school_positions p where p.id=p_position_id and p.school_id=p_school_id and p.is_active) then
    raise exception 'Active position not found in this school';
  end if;

  if p_is_primary then
    update public.dreem_position_assignments set is_primary=false,updated_at=now()
    where membership_id=p_membership_id and status='active';
  end if;

  insert into public.dreem_position_assignments(school_id,membership_id,position_id,is_primary,status,assigned_by)
  values(p_school_id,p_membership_id,p_position_id,p_is_primary,'active',(select auth.uid()))
  on conflict(membership_id,position_id)
  do update set is_primary=excluded.is_primary,status='active',assigned_by=excluded.assigned_by,updated_at=now()
  returning id into v_assignment_id;

  insert into public.audit_events(school_id,actor_id,action,entity_type,entity_id,detail)
  values(p_school_id,(select auth.uid()),'institution.position_assigned','school_membership',p_membership_id,
    jsonb_build_object('position_id',p_position_id,'primary',p_is_primary));

  return v_assignment_id;
end;
$$;
revoke all on function public.dreem_assign_school_position(uuid,uuid,uuid,boolean) from public;
grant execute on function public.dreem_assign_school_position(uuid,uuid,uuid,boolean) to authenticated;

create or replace function public.dreem_end_school_position_assignment(
  p_school_id uuid,
  p_assignment_id uuid
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if not public.dreem_has_authority(p_school_id,'staff_management')
     and not public.dreem_has_authority(p_school_id,'school_configuration') then
    raise exception 'This account cannot change institutional assignments';
  end if;
  update public.dreem_position_assignments
     set status='ended',ends_on=coalesce(ends_on,current_date),is_primary=false,updated_at=now()
   where id=p_assignment_id and school_id=p_school_id and status='active';
  if not found then raise exception 'Active position assignment not found'; end if;
  insert into public.audit_events(school_id,actor_id,action,entity_type,entity_id,detail)
  values(p_school_id,(select auth.uid()),'institution.position_assignment_ended','position_assignment',p_assignment_id,'{}'::jsonb);
end;
$$;
revoke all on function public.dreem_end_school_position_assignment(uuid,uuid) from public;
grant execute on function public.dreem_end_school_position_assignment(uuid,uuid) to authenticated;

drop policy if exists "position assignments visible to self or same school leadership" on public.dreem_position_assignments;
create policy "position assignments visible to self or authorized school staff"
on public.dreem_position_assignments for select to authenticated
using (
  exists (
    select 1 from public.dreem_school_memberships own
    where own.id=dreem_position_assignments.membership_id
      and own.profile_id=(select auth.uid())
      and own.status='approved'
  )
  or public.dreem_has_authority(dreem_position_assignments.school_id,'staff_management')
  or public.dreem_has_authority(dreem_position_assignments.school_id,'school_configuration')
  or public.dreem_has_authority(dreem_position_assignments.school_id,'audit')
);
