create table public.dreem_curriculum_outcomes(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.dreem_academic_years(id) on delete cascade,
  class_id uuid not null references public.dreem_classes(id) on delete cascade,
  subject_id uuid not null references public.dreem_subjects(id) on delete cascade,
  code text not null,
  title_en text not null,
  title_fr text,
  description text,
  source text not null default 'school' check(source in('national','school','imported')),
  status text not null default 'active' check(status in('draft','active','retired')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,academic_year_id,class_id,subject_id,code)
);

create table public.dreem_lesson_plan_outcomes(
  lesson_plan_id uuid not null references public.dreem_lesson_plans(id) on delete cascade,
  outcome_id uuid not null references public.dreem_curriculum_outcomes(id) on delete restrict,
  primary key(lesson_plan_id,outcome_id)
);

alter table public.dreem_curriculum_outcomes enable row level security;
alter table public.dreem_lesson_plan_outcomes enable row level security;

create policy dreem_curriculum_outcomes_read on public.dreem_curriculum_outcomes
for select to authenticated using (
  (select private.dreem_has_role(school_id,array['leadership','academic_head','teacher','tutor','auditor']))
);
create policy dreem_lesson_plan_outcomes_read on public.dreem_lesson_plan_outcomes
for select to authenticated using (
  exists(select 1 from public.dreem_lesson_plans lp where lp.id=lesson_plan_id)
);

grant select on public.dreem_curriculum_outcomes,public.dreem_lesson_plan_outcomes to authenticated;
revoke insert,update,delete on public.dreem_curriculum_outcomes,public.dreem_lesson_plan_outcomes from anon,authenticated;

create function public.dreem_save_curriculum_outcome(
  p_academic_year_id uuid,p_class_id uuid,p_subject_id uuid,p_code text,
  p_title_en text,p_title_fr text,p_description text,p_source text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid := (select auth.uid()); v_school uuid; v_id uuid;
begin
  select ay.school_id into v_school from public.dreem_academic_years ay
  where ay.id=p_academic_year_id;
  if v_actor is null or v_school is null then raise exception 'Authorized academic year is required.'; end if;
  if not private.dreem_has_role(v_school,array['leadership','academic_head']) then
    raise exception 'Academic leadership permission is required.';
  end if;
  if not exists(select 1 from public.dreem_classes c where c.id=p_class_id and c.school_id=v_school)
    or not exists(select 1 from public.dreem_subjects s where s.id=p_subject_id and s.school_id=v_school)
  then raise exception 'Class and subject must belong to this school.'; end if;
  if length(trim(p_code))<1 or length(trim(p_title_en))<3 then
    raise exception 'Outcome code and English title are required.';
  end if;
  insert into public.dreem_curriculum_outcomes(
    school_id,academic_year_id,class_id,subject_id,code,title_en,title_fr,description,source,created_by
  ) values(v_school,p_academic_year_id,p_class_id,p_subject_id,upper(trim(p_code)),trim(p_title_en),nullif(trim(p_title_fr),''),nullif(trim(p_description),''),p_source,v_actor)
  on conflict(school_id,academic_year_id,class_id,subject_id,code) do update set
    title_en=excluded.title_en,title_fr=excluded.title_fr,description=excluded.description,
    source=excluded.source,status='active',updated_at=now()
  returning id into v_id;
  perform private.dreem_write_event(v_school,'curriculum_outcome',v_id,'curriculum.outcome.saved',
    concat('curriculum:',v_id),jsonb_build_object('code',upper(trim(p_code)),'source',p_source));
  return v_id;
end; $$;

create function public.dreem_review_lesson_plan(
  p_lesson_plan_id uuid,p_decision text,p_note text,p_idempotency_key text
) returns table(lesson_plan_id uuid,lesson_plan_status text)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid := (select auth.uid()); v_plan public.dreem_lesson_plans%rowtype;
begin
  select * into v_plan from public.dreem_lesson_plans where id=p_lesson_plan_id for update;
  if v_actor is null or not found then raise exception 'Lesson plan was not found.'; end if;
  if not private.dreem_has_role(v_plan.school_id,array['leadership','academic_head']) then
    raise exception 'Academic leadership permission is required.';
  end if;
  if v_plan.created_by=v_actor then raise exception 'A lesson-plan author cannot review their own plan.'; end if;
  if p_decision not in('reviewed','returned') or length(trim(p_note))<5 then
    raise exception 'A review decision and evidence note are required.';
  end if;
  update public.dreem_lesson_plans set status=p_decision,reviewed_by=v_actor,reviewed_at=now(),reviewer_note=trim(p_note),updated_at=now()
  where id=p_lesson_plan_id;
  perform private.dreem_write_event(v_plan.school_id,'lesson_plan',p_lesson_plan_id,
    concat('lesson_plan.',p_decision),concat('lesson-plan-review:',p_idempotency_key),jsonb_build_object('note',trim(p_note)));
  lesson_plan_id:=p_lesson_plan_id; lesson_plan_status:=p_decision; return next;
end; $$;

revoke all on function public.dreem_save_curriculum_outcome(uuid,uuid,uuid,text,text,text,text,text) from public,anon;
revoke all on function public.dreem_review_lesson_plan(uuid,text,text,text) from public,anon;
grant execute on function public.dreem_save_curriculum_outcome(uuid,uuid,uuid,text,text,text,text,text) to authenticated;
grant execute on function public.dreem_review_lesson_plan(uuid,text,text,text) to authenticated;

create index dreem_curriculum_outcomes_scope_idx on public.dreem_curriculum_outcomes(school_id,academic_year_id,class_id,subject_id,status);
create trigger dreem_audit_curriculum_outcomes after insert or update or delete on public.dreem_curriculum_outcomes for each row execute function private.dreem_audit_row();
