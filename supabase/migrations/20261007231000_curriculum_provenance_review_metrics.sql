create table if not exists public.dreem_curriculum_proposals(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  document_id uuid not null references public.dreem_academic_documents(id) on delete cascade,
  document_version integer not null,
  academic_year_id uuid not null references public.dreem_academic_years(id) on delete restrict,
  class_id uuid not null references public.dreem_classes(id) on delete restrict,
  subject_id uuid not null references public.dreem_subjects(id) on delete restrict,
  proposed_code text not null,
  proposed_title_en text not null,
  proposed_title_fr text,
  proposed_description text,
  source_page_start integer,
  source_page_end integer,
  source_section text,
  source_excerpt text,
  confidence numeric check(confidence is null or (confidence>=0 and confidence<=1)),
  extraction_provider text not null default 'human',
  extraction_run_id text,
  status text not null default 'proposed' check(status in('proposed','accepted','corrected','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check(source_page_start is not null or nullif(trim(source_section),'') is not null),
  check(source_page_end is null or source_page_start is not null),
  check(source_page_end is null or source_page_end>=source_page_start)
);
create index if not exists dreem_curriculum_proposals_school_status_idx on public.dreem_curriculum_proposals(school_id,status,created_at desc);
create index if not exists dreem_curriculum_proposals_document_idx on public.dreem_curriculum_proposals(document_id,document_version);

create table if not exists public.dreem_curriculum_outcome_provenance(
  outcome_id uuid primary key references public.dreem_curriculum_outcomes(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  proposal_id uuid not null references public.dreem_curriculum_proposals(id) on delete restrict,
  document_id uuid not null references public.dreem_academic_documents(id) on delete restrict,
  document_version integer not null,
  page_start integer,
  page_end integer,
  section_label text,
  source_excerpt text,
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now()
);

create table if not exists public.dreem_curriculum_suggestion_feedback(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  proposal_id uuid references public.dreem_curriculum_proposals(id) on delete set null,
  outcome_id uuid references public.dreem_curriculum_outcomes(id) on delete set null,
  teacher_user_id uuid not null references auth.users(id),
  preparation_minutes_saved integer check(preparation_minutes_saved is null or preparation_minutes_saved between -240 and 480),
  usefulness smallint not null check(usefulness between 1 and 5),
  note text,
  created_at timestamptz not null default now()
);

alter table public.dreem_curriculum_proposals enable row level security;
alter table public.dreem_curriculum_outcome_provenance enable row level security;
alter table public.dreem_curriculum_suggestion_feedback enable row level security;

drop policy if exists dreem_curriculum_proposals_read on public.dreem_curriculum_proposals;
create policy dreem_curriculum_proposals_read on public.dreem_curriculum_proposals for select to authenticated using(
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','academic_head','teacher'])
);
drop policy if exists dreem_curriculum_provenance_read on public.dreem_curriculum_outcome_provenance;
create policy dreem_curriculum_provenance_read on public.dreem_curriculum_outcome_provenance for select to authenticated using(
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','academic_head','teacher'])
);
drop policy if exists dreem_curriculum_feedback_read on public.dreem_curriculum_suggestion_feedback;
create policy dreem_curriculum_feedback_read on public.dreem_curriculum_suggestion_feedback for select to authenticated using(
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','academic_head'])
  or teacher_user_id=(select auth.uid())
);
revoke insert,update,delete on public.dreem_curriculum_proposals,public.dreem_curriculum_outcome_provenance,public.dreem_curriculum_suggestion_feedback from anon,authenticated;
grant select on public.dreem_curriculum_proposals,public.dreem_curriculum_outcome_provenance,public.dreem_curriculum_suggestion_feedback to authenticated;

create or replace function public.dreem_propose_curriculum_outcome(
 p_document_id uuid,p_academic_year_id uuid,p_class_id uuid,p_subject_id uuid,p_code text,p_title_en text,p_title_fr text,p_description text,
 p_page_start integer,p_page_end integer,p_section text,p_excerpt text,p_confidence numeric,p_provider text,p_run_id text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_doc public.dreem_academic_documents%rowtype; v_id uuid;
begin
 if v_actor is null then raise exception 'Authentication is required'; end if;
 select * into v_doc from public.dreem_academic_documents where id=p_document_id;
 if not found then raise exception 'Curriculum source document not found'; end if;
 if not private.dreem_has_role(v_doc.school_id,array['platform_founder','school_owner','principal','administrator','academic_head','teacher']) then raise exception 'Academic access is required'; end if;
 if nullif(trim(p_code),'') is null or nullif(trim(p_title_en),'') is null then raise exception 'Outcome code and title are required'; end if;
 if p_page_start is null and nullif(trim(coalesce(p_section,'')),'') is null then raise exception 'Page or section provenance is required'; end if;
 insert into public.dreem_curriculum_proposals(
  school_id,document_id,document_version,academic_year_id,class_id,subject_id,proposed_code,proposed_title_en,proposed_title_fr,proposed_description,
  source_page_start,source_page_end,source_section,source_excerpt,confidence,extraction_provider,extraction_run_id,created_by
 ) values(
  v_doc.school_id,v_doc.id,v_doc.version,p_academic_year_id,p_class_id,p_subject_id,upper(trim(p_code)),trim(p_title_en),nullif(trim(p_title_fr),''),
  nullif(trim(p_description),''),p_page_start,p_page_end,nullif(trim(p_section),''),nullif(trim(p_excerpt),''),p_confidence,coalesce(nullif(trim(p_provider),''),'human'),nullif(trim(p_run_id),''),v_actor
 ) returning id into v_id;
 return v_id;
end;$$;

create or replace function public.dreem_review_curriculum_proposal(
 p_proposal_id uuid,p_decision text,p_code text,p_title_en text,p_title_fr text,p_description text,p_note text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_p public.dreem_curriculum_proposals%rowtype; v_outcome uuid;
begin
 if v_actor is null then raise exception 'Authentication is required'; end if;
 select * into v_p from public.dreem_curriculum_proposals where id=p_proposal_id for update;
 if not found or v_p.status<>'proposed' then raise exception 'Open curriculum proposal not found'; end if;
 if not private.dreem_has_role(v_p.school_id,array['platform_founder','school_owner','principal','administrator','academic_head']) then raise exception 'Academic approval authority is required'; end if;
 if p_decision not in('accepted','corrected','rejected') then raise exception 'Decision must be accepted, corrected or rejected'; end if;
 if p_decision='rejected' then
   update public.dreem_curriculum_proposals set status='rejected',reviewed_by=v_actor,reviewed_at=now(),review_note=nullif(trim(p_note),'') where id=v_p.id;
   return null;
 end if;
 if nullif(trim(coalesce(p_code,v_p.proposed_code)),'') is null or nullif(trim(coalesce(p_title_en,v_p.proposed_title_en)),'') is null then raise exception 'Approved outcome code and title are required'; end if;
 insert into public.dreem_curriculum_outcomes(school_id,academic_year_id,class_id,subject_id,code,title_en,title_fr,description,source,status,created_by)
 values(v_p.school_id,v_p.academic_year_id,v_p.class_id,v_p.subject_id,upper(trim(coalesce(p_code,v_p.proposed_code))),trim(coalesce(p_title_en,v_p.proposed_title_en)),
 nullif(trim(coalesce(p_title_fr,v_p.proposed_title_fr)),''),nullif(trim(coalesce(p_description,v_p.proposed_description)),''),'imported','active',v_actor)
 returning id into v_outcome;
 insert into public.dreem_curriculum_outcome_provenance(outcome_id,school_id,proposal_id,document_id,document_version,page_start,page_end,section_label,source_excerpt,approved_by)
 values(v_outcome,v_p.school_id,v_p.id,v_p.document_id,v_p.document_version,v_p.source_page_start,v_p.source_page_end,v_p.source_section,v_p.source_excerpt,v_actor);
 update public.dreem_curriculum_proposals set status=p_decision,reviewed_by=v_actor,reviewed_at=now(),review_note=nullif(trim(p_note),'') where id=v_p.id;
 return v_outcome;
end;$$;

create or replace function public.dreem_record_curriculum_suggestion_feedback(
 p_proposal_id uuid,p_outcome_id uuid,p_usefulness smallint,p_minutes_saved integer,p_note text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_school uuid; v_id uuid;
begin
 if v_actor is null then raise exception 'Authentication is required'; end if;
 select coalesce(p.school_id,o.school_id) into v_school from (select * from public.dreem_curriculum_proposals where id=p_proposal_id) p
 full join (select * from public.dreem_curriculum_outcomes where id=p_outcome_id) o on true limit 1;
 if v_school is null then raise exception 'Curriculum suggestion not found'; end if;
 if not private.dreem_has_role(v_school,array['teacher','academic_head','leadership']) then raise exception 'Teaching membership is required'; end if;
 insert into public.dreem_curriculum_suggestion_feedback(school_id,proposal_id,outcome_id,teacher_user_id,preparation_minutes_saved,usefulness,note)
 values(v_school,p_proposal_id,p_outcome_id,v_actor,p_minutes_saved,p_usefulness,nullif(trim(p_note),'')) returning id into v_id;
 return v_id;
end;$$;

revoke all on function public.dreem_propose_curriculum_outcome(uuid,uuid,uuid,uuid,text,text,text,text,integer,integer,text,text,numeric,text,text) from public,anon;
revoke all on function public.dreem_review_curriculum_proposal(uuid,text,text,text,text,text,text) from public,anon;
revoke all on function public.dreem_record_curriculum_suggestion_feedback(uuid,uuid,smallint,integer,text) from public,anon;
grant execute on function public.dreem_propose_curriculum_outcome(uuid,uuid,uuid,uuid,text,text,text,text,integer,integer,text,text,numeric,text,text) to authenticated,service_role;
grant execute on function public.dreem_review_curriculum_proposal(uuid,text,text,text,text,text,text) to authenticated,service_role;
grant execute on function public.dreem_record_curriculum_suggestion_feedback(uuid,uuid,smallint,integer,text) to authenticated,service_role;