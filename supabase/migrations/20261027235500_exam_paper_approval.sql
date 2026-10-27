-- Independent academic approval for persistent assessment papers.
alter table public.dreem_exam_papers
 add column status text not null default 'draft'
 check(status in ('draft','submitted','approved','returned')),
 add column submitted_at timestamptz,
 add column reviewed_by uuid references auth.users(id),
 add column reviewed_at timestamptz,
 add column review_note text;
create index dreem_exam_papers_review_queue_idx on public.dreem_exam_papers(school_id,status,updated_at desc);
create function public.dreem_submit_exam_paper(p_paper_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_row public.dreem_exam_papers%rowtype;
begin
 select * into v_row from public.dreem_exam_papers where id=p_paper_id for update;
 if v_actor is null or not found or v_row.created_by<>v_actor or v_row.status<>'draft'
 then raise exception 'Only your own draft exam paper can be submitted';end if;
 update public.dreem_exam_papers set status='submitted',submitted_at=now(),review_note=null,updated_at=now() where id=p_paper_id;
 perform private.dreem_write_event(v_row.school_id,'exam_paper',p_paper_id,'exam_paper.submitted',
 'exam-paper-submit:'||p_paper_id||':'||v_row.revision,
 jsonb_build_object('revision',v_row.revision,'total_marks',v_row.total_marks));
 return p_paper_id;
end;$$;
create function public.dreem_review_exam_paper(p_paper_id uuid,p_decision text,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_row public.dreem_exam_papers%rowtype;
begin
 select * into v_row from public.dreem_exam_papers where id=p_paper_id for update;
 if v_actor is null or not found then raise exception 'Paper not found';end if;
 if not private.dreem_has_role(v_row.school_id,array['leadership','academic_head'])
 or v_row.created_by=v_actor then raise exception 'Independent academic approval required';end if;
 if v_row.status<>'submitted' or p_decision not in ('approved','returned') or
 length(trim(coalesce(p_note,'')))<5 then raise exception 'Submitted paper, decision and review findings required';end if;
 update public.dreem_exam_papers set status=p_decision,reviewed_by=v_actor,
 reviewed_at=now(),review_note=trim(p_note),updated_at=now() where id=p_paper_id;
 perform private.dreem_write_event(v_row.school_id,'exam_paper',p_paper_id,
 'exam_paper.'||p_decision,'exam-paper-review:'||p_paper_id||':'||v_row.revision,
 jsonb_build_object('revision',v_row.revision,'note',trim(p_note)));
 return p_paper_id;
end;$$;
revoke all on function public.dreem_submit_exam_paper(uuid) from public,anon;
revoke all on function public.dreem_review_exam_paper(uuid,text,text) from public,anon;
grant execute on function public.dreem_submit_exam_paper(uuid) to authenticated;
grant execute on function public.dreem_review_exam_paper(uuid,text,text) to authenticated;

-- Existing save function must not allow overwriting submitted or approved work.
create or replace function public.dreem_save_exam_paper(
 p_title text,p_term_label text,p_duration integer,p_question_ids uuid[],p_paper_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_question record;
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
   raise exception 'Questions must share one school, class and academic year';end if;
  if not private.dreem_has_role(v_school,array['leadership','academic_head'])
   and not exists(select 1 from public.dreem_teaching_assignments a
    where a.school_id=v_school and a.academic_year_id=v_year
    and a.class_id=v_class and a.subject_id=v_question.subject_id
    and a.teacher_user_id=v_actor and a.status='active')
  then raise exception 'Not assigned to every subject in this paper';end if;
  v_total:=v_total+v_question.points;
  v_snapshot:=v_snapshot||jsonb_build_array(jsonb_build_object(
   'id',v_question.id,'outcome_id',v_question.outcome_id,'language',v_question.language,
   'question_type',v_question.question_type,'question_text',v_question.question_text,
   'choices',v_question.choices,'answer_key',v_question.answer_key,
   'marking_guide',v_question.marking_guide,'points',v_question.points));
 end loop;
 if p_paper_id is not null then
  select * into v_existing from public.dreem_exam_papers where id=p_paper_id for update;
  if not found or v_existing.school_id<>v_school or v_existing.created_by<>v_actor
    or v_existing.status not in ('draft','returned')
  then raise exception 'Only your draft or returned paper may be revised';end if;
  update public.dreem_exam_papers set class_id=v_class,academic_year_id=v_year,
   title=trim(p_title),term_label=left(trim(coalesce(p_term_label,'')),80),
   duration_minutes=p_duration,question_ids=p_question_ids,snapshot=v_snapshot,total_marks=v_total,
   revision=revision+1,status='draft',review_note=null,reviewed_by=null,reviewed_at=null,
   submitted_at=null,updated_at=now() where id=p_paper_id returning id into v_id;
 else
  insert into public.dreem_exam_papers(school_id,class_id,academic_year_id,title,term_label,
  duration_minutes,question_ids,snapshot,total_marks,created_by)
  values(v_school,v_class,v_year,trim(p_title),left(trim(coalesce(p_term_label,'')),80),
  p_duration,p_question_ids,v_snapshot,v_total,v_actor) returning id into v_id;
 end if;
 insert into public.dreem_exam_paper_revisions(
 paper_id,school_id,revision,question_ids,snapshot,title,term_label,duration_minutes,total_marks,created_by)
 select id,school_id,revision,question_ids,snapshot,title,term_label,duration_minutes,total_marks,v_actor
 from public.dreem_exam_papers where id=v_id;
 perform private.dreem_write_event(v_school,'exam_paper',v_id,'exam_paper.draft_saved',
 'exam-paper-revision:'||v_id||':'||(select revision from public.dreem_exam_papers where id=v_id),
 jsonb_build_object('question_count',cardinality(p_question_ids),'total_marks',v_total));
 return v_id;
end;$$;
revoke all on function public.dreem_save_exam_paper(text,text,integer,uuid[],uuid) from public,anon;
grant execute on function public.dreem_save_exam_paper(text,text,integer,uuid[],uuid) to authenticated;
