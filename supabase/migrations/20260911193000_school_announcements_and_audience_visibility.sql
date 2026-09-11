create table if not exists public.dreem_announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  title text not null check (char_length(trim(title)) between 3 and 160),
  body text not null check (char_length(trim(body)) between 3 and 4000),
  audience text not null default 'all' check (audience in ('all','staff','families','students')),
  priority text not null default 'normal' check (priority in ('normal','important','urgent')),
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > published_at)
);

create index if not exists dreem_announcements_school_published_idx
  on public.dreem_announcements(school_id,published_at desc);
create index if not exists dreem_announcements_school_audience_idx
  on public.dreem_announcements(school_id,audience);

alter table public.dreem_announcements enable row level security;

revoke all on table public.dreem_announcements from anon;
grant select on table public.dreem_announcements to authenticated;

drop policy if exists "members read scoped announcements" on public.dreem_announcements;
create policy "members read scoped announcements"
on public.dreem_announcements
for select
to authenticated
using (
  exists (
    select 1
    from public.dreem_school_memberships m
    where m.profile_id = (select auth.uid())
      and m.school_id = dreem_announcements.school_id
      and m.status = 'approved'
      and (
        dreem_announcements.audience = 'all'
        or (dreem_announcements.audience = 'staff' and m.role not in ('parent','student'))
        or (dreem_announcements.audience = 'families' and m.role = 'parent')
        or (dreem_announcements.audience = 'students' and m.role = 'student')
      )
  )
  and (dreem_announcements.expires_at is null or dreem_announcements.expires_at > now())
);

create or replace function public.dreem_publish_announcement(
  p_title text,
  p_body text,
  p_audience text default 'all',
  p_priority text default 'normal',
  p_expires_at timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
  v_id uuid;
begin
  v_school_id := private.dreem_active_school_for_role(array['leadership','administrator','academic_head']);
  if v_school_id is null then
    raise exception 'You do not have permission to publish school announcements';
  end if;
  if char_length(trim(coalesce(p_title,''))) < 3 then raise exception 'Announcement title is required'; end if;
  if char_length(trim(coalesce(p_body,''))) < 3 then raise exception 'Announcement message is required'; end if;
  if p_audience not in ('all','staff','families','students') then raise exception 'Invalid announcement audience'; end if;
  if p_priority not in ('normal','important','urgent') then raise exception 'Invalid announcement priority'; end if;
  if p_expires_at is not null and p_expires_at <= now() then raise exception 'Announcement expiry must be in the future'; end if;

  insert into public.dreem_announcements(school_id,title,body,audience,priority,expires_at,created_by)
  values(v_school_id,trim(p_title),trim(p_body),p_audience,p_priority,p_expires_at,(select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.dreem_publish_announcement(text,text,text,text,timestamptz) from public;
grant execute on function public.dreem_publish_announcement(text,text,text,text,timestamptz) to authenticated;
