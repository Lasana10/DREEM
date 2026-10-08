alter table public.dreem_curriculum_proposals
  add column if not exists teacher_decision text check(teacher_decision is null or teacher_decision in('accepted','corrected','rejected')),
  add column if not exists teacher_code text,
  add column if not exists teacher_title_en text,
  add column if not exists teacher_title_fr text,
  add column if not exists teacher_description text,
  add column if not exists teacher_note text,
  add column if not exists teacher_reviewed_by uuid references auth.users(id),
  add column if not exists teacher_reviewed_at timestamptz;

create or replace function public.dreem_teacher_review_curriculum_proposal(
 p_proposal_id uuid,p_decision text,p_code text,p_title_en text,p_title_fr text,p_description text,p_note text,p_usefulness smallint,p_minutes_saved integer
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_p public.dreem_curriculum_proposals%rowtype; v_feedback uuid;
begin
 if v_actor is null then raise exception 'Authentication is required'; end if;
 select * into v_p from public.dreem_curriculum_proposals where id=p_proposal_id for update;
 if not found or v_p.status<>'proposed' then raise exception 'Open curriculum proposal not found'; end if;
 if not private.dreem_has_role(v_p.school_id,array['teacher','academic_head','leadership']) then raise exception 'Teaching membership is required'; end if;
 if p_decision not in('accepted','corrected','rejected') then raise exception 'Decision must be accepted, corrected or rejected'; end if;
 if p_decision='corrected' and (nullif(trim(coalesce(p_code,'')),'') is null or nullif(trim(coalesce(p_title_en,'')),'') is null) then
   raise exception 'Corrected code and English title are required';
 end if;
 update public.dreem_curriculum_proposals
 set teacher_decision=p_decision,
     teacher_code=case when p_decision='corrected' then upper(trim(p_code)) else null end,
     teacher_title_en=case when p_decision='corrected' then trim(p_title_en) else null end,
     teacher_title_fr=case when p_decision='corrected' then nullif(trim(p_title_fr),'') else null end,
     teacher_description=case when p_decision='corrected' then nullif(trim(p_description),'') else null end,
     teacher_note=nullif(trim(p_note),''),
     teacher_reviewed_by=v_actor,
     teacher_reviewed_at=now()
 where id=v_p.id;
 insert into public.dreem_curriculum_suggestion_feedback(school_id,proposal_id,teacher_user_id,preparation_minutes_saved,usefulness,note)
 values(v_p.school_id,v_p.id,v_actor,p_minutes_saved,p_usefulness,nullif(trim(p_note),'')) returning id into v_feedback;
 return v_feedback;
end;$$;

create or replace function public.dreem_review_curriculum_proposal(
 p_proposal_id uuid,p_decision text,p_code text,p_title_en text,p_title_fr text,p_description text,p_note text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_p public.dreem_curriculum_proposals%rowtype; v_outcome uuid; v_code text; v_en text; v_fr text; v_desc text;
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
 v_code:=coalesce(nullif(trim(p_code),''),case when v_p.teacher_decision='corrected' then v_p.teacher_code else null end,v_p.proposed_code);
 v_en:=coalesce(nullif(trim(p_title_en),''),case when v_p.teacher_decision='corrected' then v_p.teacher_title_en else null end,v_p.proposed_title_en);
 v_fr:=coalesce(nullif(trim(p_title_fr),''),case when v_p.teacher_decision='corrected' then v_p.teacher_title_fr else null end,v_p.proposed_title_fr);
 v_desc:=coalesce(nullif(trim(p_description),''),case when v_p.teacher_decision='corrected' then v_p.teacher_description else null end,v_p.proposed_description);
 if nullif(trim(v_code),'') is null or nullif(trim(v_en),'') is null then raise exception 'Approved outcome code and title are required'; end if;
 insert into public.dreem_curriculum_outcomes(school_id,academic_year_id,class_id,subject_id,code,title_en,title_fr,description,source,status,created_by)
 values(v_p.school_id,v_p.academic_year_id,v_p.class_id,v_p.subject_id,upper(trim(v_code)),trim(v_en),nullif(trim(v_fr),''),nullif(trim(v_desc),''),'imported','active',v_actor)
 returning id into v_outcome;
 insert into public.dreem_curriculum_outcome_provenance(outcome_id,school_id,proposal_id,document_id,document_version,page_start,page_end,section_label,source_excerpt,approved_by)
 values(v_outcome,v_p.school_id,v_p.id,v_p.document_id,v_p.document_version,v_p.source_page_start,v_p.source_page_end,v_p.source_section,v_p.source_excerpt,v_actor);
 update public.dreem_curriculum_proposals set status=p_decision,reviewed_by=v_actor,reviewed_at=now(),review_note=nullif(trim(p_note),'') where id=v_p.id;
 return v_outcome;
end;$$;

revoke all on function public.dreem_teacher_review_curriculum_proposal(uuid,text,text,text,text,text,text,smallint,integer) from public,anon;
grant execute on function public.dreem_teacher_review_curriculum_proposal(uuid,text,text,text,text,text,text,smallint,integer) to authenticated,service_role;