-- Store controlled exam-paper drafts without duplicating curriculum or school registries.
create table public.dreem_exam_papers(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 class_id uuid not null references public.dreem_classes(id),
 academic_year_id uuid not null references public.dreem_academic_years(id),
 title text not null check(length(trim(title)) between 3 and 120),
 term_label text not null default '',
 duration_minutes integer not null check(duration_minutes between 1 and 300),
 question_ids uuid[] not null,
 snapshot jsonb not null check(jsonb_typeof(snapshot)='array'),
 total_marks integer not null check(total_marks between 1 and 5000),
 created_by uuid not null references auth.users(id),
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index dreem_exam_papers_school_idx on public.dreem_exam_papers(school_id,created_at desc);
alter table public.dreem_exam_papers enable row level security;
revoke all on public.dreem_exam_papers from public,anon,authenticated;
grant select on public.dreem_exam_papers to authenticated;
create policy dreem_exam_papers_staff_read on public.dreem_exam_papers for select to authenticated using(
 created_by=(select auth.uid()) or
 (select private.dreem_has_role(school_id,array['leadership','academic_head']))
);
create trigger dreem_exam_papers_audit after insert or update or delete
 on public.dreem_exam_papers for each row execute function private.dreem_audit_row();

create function public.dreem_save_exam_paper(
 p_title text,p_term_label text,p_duration integer,p_question_ids uuid[],p_paper_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_first record;v_question record;
 v_school uuid;v_class uuid;v_year uuid;v_snapshot jsonb:='[]'::jsonb;v_total integer:=0;
 v_id uuid;v_existing public.dreem_exam_papers%rowtype;v_question_id uuid;
begin
 if v_actor is null then raise exception 'Sign in required';end if;
 if length(trim(coalesce(p_title,''))) not between 3 and 120 or p_duration not between 1 and 300
  or coalesce(cardinality(p_question_ids),0) not between 1 and 50
  or (select count(distinct x) from unnest(p_question_ids) x)<>cardinality(p_question_ids)
 then raise exception 'Provide a title, duration and 1–50 distinct approved questions';end if;
 foreach v_question_id in array p_question_ids loop
  select q.*,o.class_id,o.academic_year_id,o.subject_id into v_question
  from public.dreem_question_bank q join public.dreem_curriculum_outcomes o on o.id=q.outcome_id
  where q.id=v_question_id and q.status='approved' and o.status='active';
  if not found then raise exception 'A selected question is unavailable or unapproved';end if;
  if v_school is null then
   v_school:=v_question.school_id;v_class:=v_question.class_id;v_year:=v_question.academic_year_id;
  elsif v_question.school_id<>v_school or v_question.class_id<>v_class or v_question.academic_year_id<>v_year then
   raise exception 'All questions must belong to the same school, class and academic year';end if;
  if not private.dreem_has_role(v_school,array['leadership','academic_head'])
   and not exists(select 1 from public.dreem_teaching_assignments a
    where a.school_id=v_school and a.academic_year_id=v_year
    and a.class_id=v_class and a.subject_id=v_question.subject_id
    and a.teacher_user_id=v_actor and a.status='active')
  then raise exception 'Not assigned to all subjects in this paper';end if;
  v_total:=v_total+v_question.points;
  v_snapshot:=v_snapshot||jsonb_build_array(jsonb_build_object(
   'id',v_question.id,'outcome_id',v_question.outcome_id,'language',v_question.language,
   'question_type',v_question.question_type,'question_text',v_question.question_text,
   'choices',v_question.choices,'answer_key',v_question.answer_key,
   'marking_guide',v_question.marking_guide,'points',v_question.points));
 end loop;
 if p_paper_id is not null then
  select * into v_existing from public.dreem_exam_papers where id=p_paper_id for update;
  if not found or v_existing.school_id<>v_school or v_existing.created_by<>v_actor then
   raise exception 'Only the creator may revise this school paper';end if;
  update public.dreem_exam_papers set class_id=v_class,academic_year_id=v_year,
   title=trim(p_title),term_label=left(trim(coalesce(p_term_label,'')),80),
   duration_minutes=p_duration,question_ids=p_question_ids,snapshot=v_snapshot,total_marks=v_total,
   revision=revision+1,updated_at=now() where id=p_paper_id returning id into v_id;
 else
  insert into public.dreem_exam_papers(school_id,class_id,academic_year_id,title,term_label,
  duration_minutes,question_ids,snapshot,total_marks,created_by)
  values(v_school,v_class,v_year,trim(p_title),left(trim(coalesce(p_term_label,'')),80),
  p_duration,p_question_ids,v_snapshot,v_total,v_actor) returning id into v_id;
 end if;
 perform private.dreem_write_event(v_school,'exam_paper',v_id,'exam_paper.draft_saved',
 'exam-paper-revision:'||v_id||':'||(select revision from public.dreem_exam_papers where id=v_id),
 jsonb_build_object('question_count',cardinality(p_question_ids),'total_marks',v_total));
 return v_id;
end;$$;
revoke all on function public.dreem_save_exam_paper(text,text,integer,uuid[],uuid) from public,anon;
grant execute on function public.dreem_save_exam_paper(text,text,integer,uuid[],uuid) to authenticated;
