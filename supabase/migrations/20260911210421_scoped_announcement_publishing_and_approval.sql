alter table public.dreem_announcements add column if not exists category text not null default 'general';
alter table public.dreem_announcements add column if not exists publication_status text not null default 'published';
alter table public.dreem_announcements add column if not exists approved_by uuid;
alter table public.dreem_announcements add column if not exists approved_at timestamptz;
alter table public.dreem_announcements add column if not exists requested_at timestamptz not null default now();

alter table public.dreem_announcements drop constraint if exists dreem_announcements_category_check;
alter table public.dreem_announcements add constraint dreem_announcements_category_check check (category in ('general','administrative','academic','event','transport','finance','emergency'));
alter table public.dreem_announcements drop constraint if exists dreem_announcements_publication_status_check;
alter table public.dreem_announcements add constraint dreem_announcements_publication_status_check check (publication_status in ('pending_approval','published','rejected','withdrawn'));

alter table public.dreem_announcements alter column published_at drop not null;
alter table public.dreem_announcements alter column published_at drop default;
update public.dreem_announcements set publication_status='published', published_at=coalesce(published_at,created_at) where publication_status is null or publication_status='published';

drop policy if exists "members read scoped announcements" on public.dreem_announcements;
create policy "members read scoped published announcements" on public.dreem_announcements for select to authenticated using (
  publication_status='published' and exists (
    select 1 from public.dreem_school_memberships m
    where m.profile_id=(select auth.uid()) and m.school_id=dreem_announcements.school_id and m.status='approved'
      and (dreem_announcements.audience='all' or (dreem_announcements.audience='staff' and m.role not in ('parent','student')) or (dreem_announcements.audience='families' and m.role='parent') or (dreem_announcements.audience='students' and m.role='student'))
  ) and (expires_at is null or expires_at > now())
);

create or replace function public.dreem_publish_announcement_v2(p_school_id uuid,p_title text,p_body text,p_audience text,p_priority text,p_category text,p_expires_at timestamptz default null)
returns table(announcement_id uuid, publication_status text)
language plpgsql security definer set search_path=''
as $$
declare v_role text; v_status text; v_id uuid;
begin
  select m.role into v_role from public.dreem_school_memberships m where m.profile_id=(select auth.uid()) and m.school_id=p_school_id and m.status='approved' limit 1;
  if v_role is null then raise exception 'No approved membership for this school'; end if;
  if char_length(trim(coalesce(p_title,''))) < 3 then raise exception 'Announcement title is required'; end if;
  if char_length(trim(coalesce(p_body,''))) < 3 then raise exception 'Announcement message is required'; end if;
  if p_audience not in ('all','staff','families','students') then raise exception 'Invalid announcement audience'; end if;
  if p_priority not in ('normal','important','urgent') then raise exception 'Invalid announcement priority'; end if;
  if p_category not in ('general','administrative','academic','event','transport','finance','emergency') then raise exception 'Invalid announcement category'; end if;
  if p_expires_at is not null and p_expires_at <= now() then raise exception 'Announcement expiry must be in the future'; end if;

  if v_role in ('platform_founder','school_owner','principal') then v_status:='published';
  elsif v_role='administrator' then
    if p_category not in ('general','administrative','event','transport') then raise exception 'Administrator cannot publish this announcement category'; end if;
    v_status:=case when p_priority='urgent' then 'pending_approval' else 'published' end;
  elsif v_role='academic_head' then
    if p_category not in ('general','academic','event') then raise exception 'Academic Head can publish only academic, event or general notices'; end if;
    v_status:=case when p_priority='urgent' then 'pending_approval' else 'published' end;
  elsif v_role='transport_manager' then
    if p_category <> 'transport' then raise exception 'Transport Manager can publish only transport notices'; end if;
    if p_audience='all' then raise exception 'Transport Manager cannot publish whole-school notices'; end if;
    v_status:=case when p_priority='urgent' then 'pending_approval' else 'published' end;
  else raise exception 'This role cannot publish official school notices'; end if;

  insert into public.dreem_announcements(school_id,title,body,audience,priority,category,publication_status,published_at,expires_at,created_by,approved_by,approved_at)
  values(p_school_id,trim(p_title),trim(p_body),p_audience,p_priority,p_category,v_status,case when v_status='published' then now() else null end,p_expires_at,(select auth.uid()),case when v_status='published' and v_role in ('platform_founder','school_owner','principal') then (select auth.uid()) else null end,case when v_status='published' and v_role in ('platform_founder','school_owner','principal') then now() else null end)
  returning id into v_id;
  return query select v_id,v_status;
end;$$;
revoke all on function public.dreem_publish_announcement_v2(uuid,text,text,text,text,text,timestamptz) from public;
grant execute on function public.dreem_publish_announcement_v2(uuid,text,text,text,text,text,timestamptz) to authenticated;

create or replace function public.dreem_get_announcement_review_queue(p_school_id uuid)
returns table(id uuid,title text,body text,audience text,priority text,category text,requested_at timestamptz,created_by uuid)
language plpgsql security definer set search_path=''
as $$
begin
  if not exists (select 1 from public.dreem_school_memberships m where m.profile_id=(select auth.uid()) and m.school_id=p_school_id and m.status='approved' and m.role in ('platform_founder','school_owner','principal')) then raise exception 'Leadership approval is required'; end if;
  return query select a.id,a.title,a.body,a.audience,a.priority,a.category,a.requested_at,a.created_by from public.dreem_announcements a where a.school_id=p_school_id and a.publication_status='pending_approval' order by a.requested_at asc;
end;$$;
revoke all on function public.dreem_get_announcement_review_queue(uuid) from public;
grant execute on function public.dreem_get_announcement_review_queue(uuid) to authenticated;

create or replace function public.dreem_review_announcement(p_announcement_id uuid,p_decision text)
returns text language plpgsql security definer set search_path=''
as $$
declare v_school_id uuid;
begin
  select a.school_id into v_school_id from public.dreem_announcements a where a.id=p_announcement_id;
  if v_school_id is null then raise exception 'Announcement not found'; end if;
  if not exists (select 1 from public.dreem_school_memberships m where m.profile_id=(select auth.uid()) and m.school_id=v_school_id and m.status='approved' and m.role in ('platform_founder','school_owner','principal')) then raise exception 'Leadership approval is required'; end if;
  if p_decision not in ('approve','reject') then raise exception 'Invalid review decision'; end if;
  update public.dreem_announcements set publication_status=case when p_decision='approve' then 'published' else 'rejected' end,published_at=case when p_decision='approve' then now() else null end,approved_by=(select auth.uid()),approved_at=now(),updated_at=now() where id=p_announcement_id and publication_status='pending_approval';
  if not found then raise exception 'Announcement is no longer awaiting approval'; end if;
  return case when p_decision='approve' then 'published' else 'rejected' end;
end;$$;
revoke all on function public.dreem_review_announcement(uuid,text) from public;
grant execute on function public.dreem_review_announcement(uuid,text) to authenticated;
