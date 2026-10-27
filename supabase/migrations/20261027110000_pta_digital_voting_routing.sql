-- DREEM PTA digital decisions, indicative parent poll and private school routing.
-- Applies AFTER 20261026150000_public_pre_pta_parent_voice.sql.
-- Informal consultation poll only: browser token limits repeats on one device, not verified election identity.
create table public.dreem_pta_proposals (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.dreem_pta_campaigns(id) on delete cascade,
 school_id uuid not null references public.schools(id) on delete cascade,
 title_en text not null check (char_length(trim(title_en)) between 5 and 200),
 title_fr text not null check (char_length(trim(title_fr)) between 5 and 200),
 detail_en text not null default '',
 detail_fr text not null default '',
 published boolean not null default false,
 decision text not null default 'pending' check(decision in ('pending','approved','declined','deferred')),
 decision_note text not null default '',
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index dreem_pta_proposals_campaign_idx on public.dreem_pta_proposals(campaign_id,published);
alter table public.dreem_pta_proposals enable row level security;
revoke all on public.dreem_pta_proposals from anon,authenticated;

create table public.dreem_pta_ballots (
 proposal_id uuid not null references public.dreem_pta_proposals(id) on delete cascade,
 school_id uuid not null references public.schools(id) on delete cascade,
 voter_digest text not null check(char_length(voter_digest)=64),
 choice text not null check(choice in ('support','oppose','abstain')),
 created_at timestamptz not null default now(),
 primary key(proposal_id,voter_digest)
);
alter table public.dreem_pta_ballots enable row level security;
revoke all on public.dreem_pta_ballots from anon,authenticated;

alter table public.dreem_pta_submissions
 add column assigned_department text not null default 'leadership'
 check(assigned_department in ('leadership','academics','facilities','administration','pta')),
 add column action_note text not null default '',
 add column action_owner text not null default '',
 add column target_date date;

create function public.dreem_pta_public_proposals(p_campaign_id uuid)
returns table(id uuid,title_en text,title_fr text,detail_en text,detail_fr text,support_count bigint,oppose_count bigint,abstain_count bigint)
language sql security definer set search_path='' as $$
 select p.id,p.title_en,p.title_fr,p.detail_en,p.detail_fr,
 count(b.proposal_id) filter(where b.choice='support'),
 count(b.proposal_id) filter(where b.choice='oppose'),
 count(b.proposal_id) filter(where b.choice='abstain')
 from public.dreem_pta_proposals p
 join public.dreem_pta_campaigns c on c.id=p.campaign_id and c.school_id=p.school_id
 left join public.dreem_pta_ballots b on b.proposal_id=p.id
 where p.campaign_id=p_campaign_id and p.published=true and c.published=true
 and (c.closes_at is null or c.closes_at>now())
 group by p.id,p.title_en,p.title_fr,p.detail_en,p.detail_fr,p.created_at
 order by p.created_at asc limit 30
$$;
revoke all on function public.dreem_pta_public_proposals(uuid) from public;
grant execute on function public.dreem_pta_public_proposals(uuid) to anon,authenticated;

-- Service-role-only RPC, callable only after server-side Cloudflare Turnstile.
-- The digest is HMAC of browser ballot id: never store browser identity in database.
create function public.dreem_pta_record_ballot(p_proposal_id uuid,p_voter_digest text,p_choice text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_school uuid;
begin
 if p_choice not in ('support','oppose','abstain') or p_voter_digest !~ '^[0-9a-f]{64}$' then
  raise exception 'Invalid consultation response';
 end if;
 select p.school_id into v_school
 from public.dreem_pta_proposals p join public.dreem_pta_campaigns c on c.id=p.campaign_id and c.school_id=p.school_id
 where p.id=p_proposal_id and p.published=true and c.published=true
 and (c.closes_at is null or c.closes_at>now());
 if v_school is null then raise exception 'Poll is closed'; end if;
 insert into public.dreem_pta_ballots(proposal_id,school_id,voter_digest,choice)
 values(p_proposal_id,v_school,p_voter_digest,p_choice)
 on conflict(proposal_id,voter_digest) do nothing;
 return found;
end $$;
revoke all on function public.dreem_pta_record_ballot(uuid,text,text) from public,anon,authenticated;
grant execute on function public.dreem_pta_record_ballot(uuid,text,text) to service_role;

create function public.dreem_pta_staff_proposals(p_campaign_id uuid)
returns table(id uuid,title_en text,title_fr text,published boolean,decision text,decision_note text,support_count bigint,oppose_count bigint,abstain_count bigint)
language plpgsql security definer set search_path='' as $$
declare v_school uuid;
begin
 v_school:=private.dreem_active_school_for_role(array['leadership']);
 if v_school is null then raise exception 'Leadership required'; end if;
 return query
 select p.id,p.title_en,p.title_fr,p.published,p.decision,p.decision_note,
 count(b.proposal_id) filter(where b.choice='support'),
 count(b.proposal_id) filter(where b.choice='oppose'),
 count(b.proposal_id) filter(where b.choice='abstain')
 from public.dreem_pta_proposals p
 left join public.dreem_pta_ballots b on b.proposal_id=p.id
 where p.campaign_id=p_campaign_id and p.school_id=v_school
 group by p.id order by p.created_at;
end $$;
create function public.dreem_pta_manage_proposal(p_campaign_id uuid,p_proposal_id uuid,p_title_en text,p_title_fr text,p_published boolean,p_decision text,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_id uuid;
begin
 v_school:=private.dreem_active_school_for_role(array['leadership']);
 if v_school is null or not exists(select 1 from public.dreem_pta_campaigns where id=p_campaign_id and school_id=v_school)
 then raise exception 'Leadership access required'; end if;
 if char_length(trim(coalesce(p_title_en,''))) not between 5 and 200
 or char_length(trim(coalesce(p_title_fr,''))) not between 5 and 200
 or p_decision not in ('pending','approved','declined','deferred')
 or char_length(coalesce(p_note,''))>1500 then raise exception 'Invalid proposal'; end if;
 if p_proposal_id is null then
  insert into public.dreem_pta_proposals(campaign_id,school_id,title_en,title_fr,published,decision,decision_note,created_by)
  values(p_campaign_id,v_school,trim(p_title_en),trim(p_title_fr),p_published,p_decision,trim(coalesce(p_note,'')),auth.uid())
  returning id into v_id;
 else
  update public.dreem_pta_proposals set title_en=trim(p_title_en),title_fr=trim(p_title_fr),
  published=p_published,decision=p_decision,decision_note=trim(coalesce(p_note,''))
  where id=p_proposal_id and campaign_id=p_campaign_id and school_id=v_school returning id into v_id;
  if v_id is null then raise exception 'Proposal not found';end if;
 end if;
 return v_id;
end $$;
create function public.dreem_pta_route_submission(p_submission_id uuid,p_department text,p_status text,p_owner text,p_note text,p_target_date date)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_school uuid;
begin
 v_school:=private.dreem_active_school_for_role(array['leadership']);
 if v_school is null then raise exception 'Leadership required'; end if;
 if p_department not in ('leadership','academics','facilities','administration','pta')
 or p_status not in ('new','under_review','action_planned','resolved','closed')
 or char_length(coalesce(p_owner,''))>160 or char_length(coalesce(p_note,''))>1500
 then raise exception 'Invalid routing details';end if;
 update public.dreem_pta_submissions
 set assigned_department=p_department,status=p_status,action_owner=trim(coalesce(p_owner,'')),
 action_note=trim(coalesce(p_note,'')),target_date=p_target_date,reviewed_by=auth.uid(),updated_at=now()
 where id=p_submission_id and school_id=v_school;
 if not found then raise exception 'Submission not found';end if;
 return true;
end $$;
-- Expand existing leadership read RPC to return routing and follow-up fields.
drop function public.dreem_pta_staff_submissions(uuid);
create function public.dreem_pta_staff_submissions(p_campaign_id uuid)
returns table(id uuid,kind text,topic text,language text,message text,contact text,status text,created_at timestamptz,assigned_department text,action_owner text,action_note text,target_date date)
language plpgsql security definer set search_path='' as $$
declare v_school uuid;
begin
 v_school:=private.dreem_active_school_for_role(array['leadership']);
 if v_school is null or not exists(select 1 from public.dreem_pta_campaigns where id=p_campaign_id and school_id=v_school)
 then raise exception 'Leadership required';end if;
 return query select s.id,s.kind,s.topic,s.language,s.message,s.contact,s.status,s.created_at,
 s.assigned_department,s.action_owner,s.action_note,s.target_date
 from public.dreem_pta_submissions s where s.campaign_id=p_campaign_id and s.school_id=v_school order by s.created_at desc limit 500;
end $$;
revoke all on function public.dreem_pta_staff_proposals(uuid),public.dreem_pta_manage_proposal(uuid,uuid,text,text,boolean,text,text),public.dreem_pta_route_submission(uuid,text,text,text,text,date),public.dreem_pta_staff_submissions(uuid) from public,anon;
grant execute on function public.dreem_pta_staff_proposals(uuid),public.dreem_pta_manage_proposal(uuid,uuid,text,text,boolean,text,text),public.dreem_pta_route_submission(uuid,text,text,text,text,date),public.dreem_pta_staff_submissions(uuid) to authenticated;
