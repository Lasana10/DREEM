-- Standalone, opt-in pre-PTA consultation within DREEM's existing school boundary.
-- No public read access to submissions. This migration must be applied before enabling links.
create table if not exists public.dreem_pta_campaigns (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 title_en text not null check(char_length(title_en) between 5 and 160),
 title_fr text not null check(char_length(title_fr) between 5 and 160),
 meeting_date date,
 published boolean not null default false,
 closes_at timestamptz,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists dreem_pta_campaigns_school_idx on public.dreem_pta_campaigns(school_id,created_at desc);

create table if not exists public.dreem_pta_submissions (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.dreem_pta_campaigns(id) on delete cascade,
 school_id uuid not null references public.schools(id) on delete cascade,
 kind text not null check(kind in ('concern','idea','question')),
 topic text not null check(topic in ('learning','facilities','safety','administration','pta','other')),
 language text not null check(language in ('en','fr')),
 message text not null check(char_length(message) between 15 and 2000),
 contact text check(contact is null or char_length(contact) <= 160),
 status text not null default 'new' check(status in ('new','under_review','action_planned','resolved','closed')),
 created_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id),
 updated_at timestamptz not null default now()
);
create index if not exists dreem_pta_submissions_campaign_idx on public.dreem_pta_submissions(campaign_id,created_at desc);
alter table public.dreem_pta_campaigns enable row level security;
alter table public.dreem_pta_submissions enable row level security;
revoke all on public.dreem_pta_campaigns from anon,authenticated;
revoke all on public.dreem_pta_submissions from anon,authenticated;

-- Staff access uses server-side membership, never trust a caller-supplied school id.
create or replace function public.dreem_pta_create_campaign(p_title_en text,p_title_fr text,p_meeting_date date default null,p_closes_at timestamptz default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_id uuid;
begin
 v_school:=private.dreem_active_school_for_role(array['leadership']);
 if v_school is null then raise exception 'School leadership access required'; end if;
 if char_length(trim(p_title_en)) not between 5 and 160 or char_length(trim(p_title_fr)) not between 5 and 160 then raise exception 'Add both meeting titles'; end if;
 if p_closes_at is not null and p_closes_at <= now() then raise exception 'Closing date must be in the future'; end if;
 insert into public.dreem_pta_campaigns(school_id,title_en,title_fr,meeting_date,closes_at,created_by)
 values(v_school,trim(p_title_en),trim(p_title_fr),p_meeting_date,p_closes_at,auth.uid()) returning id into v_id;
 return v_id;
end $$;
create or replace function public.dreem_pta_staff_campaigns()
returns table(id uuid,title_en text,title_fr text,meeting_date date,published boolean,closes_at timestamptz,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_school uuid;
begin
 v_school:=private.dreem_active_school_for_role(array['leadership']);
 if v_school is null then raise exception 'School leadership access required'; end if;
 return query select c.id,c.title_en,c.title_fr,c.meeting_date,c.published,c.closes_at,c.created_at
 from public.dreem_pta_campaigns c where c.school_id=v_school order by c.created_at desc limit 30;
end $$;
create or replace function public.dreem_pta_set_published(p_campaign_id uuid,p_published boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_school uuid;
begin
 v_school:=private.dreem_active_school_for_role(array['leadership']);
 if v_school is null then raise exception 'School leadership access required'; end if;
 update public.dreem_pta_campaigns set published=p_published where id=p_campaign_id and school_id=v_school;
 if not found then raise exception 'PTA consultation not found'; end if;
 return p_published;
end $$;
create or replace function public.dreem_pta_public_campaign(p_campaign_id uuid)
returns table(title_en text,title_fr text,meeting_date date,closes_at timestamptz)
language sql security definer set search_path='' as $$
 select c.title_en,c.title_fr,c.meeting_date,c.closes_at from public.dreem_pta_campaigns c
 where c.id=p_campaign_id and c.published=true and (c.closes_at is null or c.closes_at>now())
 limit 1
$$;
create or replace function public.dreem_pta_submit(p_campaign_id uuid,p_kind text,p_topic text,p_language text,p_message text,p_contact text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_id uuid;v_contact text:=nullif(trim(coalesce(p_contact,'')),'');
begin
 select school_id into v_school from public.dreem_pta_campaigns
 where id=p_campaign_id and published=true and (closes_at is null or closes_at>now());
 if v_school is null then raise exception 'This PTA consultation is not accepting submissions';end if;
 if p_kind not in ('concern','idea','question') or p_topic not in ('learning','facilities','administration','pta','other') or p_language not in ('en','fr') then raise exception 'Unsupported category: urgent child safety matters need direct school contact';end if;
 if char_length(trim(coalesce(p_message,''))) not between 15 and 2000 or char_length(coalesce(v_contact,''))>160 then raise exception 'Please check message length';end if;
 -- A database backstop; add edge/WAF per-client rate limiting before public distribution.
 if (select count(*) from public.dreem_pta_submissions where campaign_id=p_campaign_id and created_at>now()-interval '1 hour')>=150 then
   raise exception 'Submission limit reached; contact the school directly';
 end if;
 insert into public.dreem_pta_submissions(campaign_id,school_id,kind,topic,language,message,contact)
 values(p_campaign_id,v_school,p_kind,p_topic,p_language,trim(p_message),v_contact) returning id into v_id;
 return v_id;
end $$;
create or replace function public.dreem_pta_staff_submissions(p_campaign_id uuid)
returns table(id uuid,kind text,topic text,language text,message text,contact text,status text,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_school uuid;
begin
 v_school:=private.dreem_active_school_for_role(array['leadership']);
 if v_school is null then raise exception 'School leadership access required'; end if;
 if not exists(select 1 from public.dreem_pta_campaigns c where c.id=p_campaign_id and c.school_id=v_school) then raise exception 'Consultation not found';end if;
 return query select s.id,s.kind,s.topic,s.language,s.message,s.contact,s.status,s.created_at
 from public.dreem_pta_submissions s where s.campaign_id=p_campaign_id and s.school_id=v_school order by s.created_at desc limit 500;
end $$;
create or replace function public.dreem_pta_set_status(p_submission_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_school uuid;
begin
 v_school:=private.dreem_active_school_for_role(array['leadership']);
 if v_school is null then raise exception 'School leadership access required'; end if;
 if p_status not in ('new','under_review','action_planned','resolved','closed') then raise exception 'Invalid status'; end if;
 update public.dreem_pta_submissions set status=p_status,reviewed_by=auth.uid(),updated_at=now()
 where id=p_submission_id and school_id=v_school;
 if not found then raise exception 'Submission not found'; end if;
 return true;
end $$;

revoke all on function public.dreem_pta_create_campaign(text,text,date,timestamptz) from public,anon;
revoke all on function public.dreem_pta_staff_campaigns() from public,anon;
revoke all on function public.dreem_pta_set_published(uuid,boolean) from public,anon;
revoke all on function public.dreem_pta_staff_submissions(uuid) from public,anon;
revoke all on function public.dreem_pta_set_status(uuid,text) from public,anon;
grant execute on function public.dreem_pta_create_campaign(text,text,date,timestamptz),public.dreem_pta_staff_campaigns(),public.dreem_pta_set_published(uuid,boolean),public.dreem_pta_staff_submissions(uuid),public.dreem_pta_set_status(uuid,text) to authenticated;
revoke all on function public.dreem_pta_submit(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.dreem_pta_submit(uuid,text,text,text,text,text) to service_role;
revoke all on function public.dreem_pta_public_campaign(uuid) from public;
grant execute on function public.dreem_pta_public_campaign(uuid) to anon,authenticated;

-- Management's pre-meeting action proposals, one per general discussion topic.
-- These are separate from private individual submissions. No anonymous read.
create table public.dreem_pta_topic_plans (
 campaign_id uuid not null references public.dreem_pta_campaigns(id) on delete cascade,
 topic text not null check(topic in ('learning','facilities','administration','pta','other')),
 proposed_solution text not null default '' check(char_length(proposed_solution)<=1500),
 responsible_officer text not null default '' check(char_length(responsible_officer)<=160),
 target_date date,
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key(campaign_id,topic)
);
alter table public.dreem_pta_topic_plans enable row level security;
revoke all on public.dreem_pta_topic_plans from anon,authenticated;

create function public.dreem_pta_get_topic_plans(p_campaign_id uuid)
returns table(topic text,proposed_solution text,responsible_officer text,target_date date,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_school uuid;
begin
 v_school:=private.dreem_active_school_for_role(array['leadership']);
 if v_school is null or not exists(select 1 from public.dreem_pta_campaigns where id=p_campaign_id and school_id=v_school)
 then raise exception 'Not authorised to review this consultation';end if;
 return query select p.topic,p.proposed_solution,p.responsible_officer,p.target_date,p.updated_at
 from public.dreem_pta_topic_plans p where p.campaign_id=p_campaign_id;
end $$;
create function public.dreem_pta_save_topic_plan(p_campaign_id uuid,p_topic text,p_solution text,p_officer text,p_target_date date default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_school uuid;
begin
 v_school:=private.dreem_active_school_for_role(array['leadership']);
 if v_school is null or not exists(select 1 from public.dreem_pta_campaigns where id=p_campaign_id and school_id=v_school)
 then raise exception 'Not authorised to update this consultation';end if;
 if p_topic not in ('learning','facilities','administration','pta','other') or
 char_length(coalesce(p_solution,''))>1500 or char_length(coalesce(p_officer,''))>160
 then raise exception 'Invalid PTA proposal';end if;
 insert into public.dreem_pta_topic_plans(campaign_id,topic,proposed_solution,responsible_officer,target_date,updated_by)
 values(p_campaign_id,p_topic,trim(coalesce(p_solution,'')),trim(coalesce(p_officer,'')),p_target_date,auth.uid())
 on conflict(campaign_id,topic) do update set proposed_solution=excluded.proposed_solution,
 responsible_officer=excluded.responsible_officer,target_date=excluded.target_date,
 updated_by=excluded.updated_by,updated_at=now();
 return true;
end $$;
revoke all on function public.dreem_pta_get_topic_plans(uuid),public.dreem_pta_save_topic_plan(uuid,text,text,text,date) from public,anon;
grant execute on function public.dreem_pta_get_topic_plans(uuid),public.dreem_pta_save_topic_plan(uuid,text,text,text,date) to authenticated;
