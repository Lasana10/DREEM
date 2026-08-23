-- DREEM-ACADEMICS-002: make academic commands safe to replay after uncertain networks.

create or replace function public.dreem_schedule_timetable_entry(p_assignment_id uuid,p_weekday integer,p_starts_at time,p_ends_at time,p_room text,p_effective_from date,p_effective_to date,p_idempotency_key text)
returns table(entry_id uuid,entry_status text)
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid());v_assignment public.dreem_teaching_assignments%rowtype;v_existing public.dreem_timetable_entries%rowtype;v_id uuid;v_status text;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  select * into v_assignment from public.dreem_teaching_assignments where id=p_assignment_id;
  if not found or not private.dreem_has_role(v_assignment.school_id,array['leadership','academic_head']) then raise exception 'Academic leadership authorization is required.';end if;
  select * into v_existing from public.dreem_timetable_entries where school_id=v_assignment.school_id and idempotency_key=p_idempotency_key;
  if found then entry_id:=v_existing.id;entry_status:=v_existing.status;return next;return;end if;
  if v_assignment.status not in ('planned','active') then raise exception 'The teaching assignment is not schedulable.';end if;
  if p_weekday not between 1 and 7 or p_starts_at>=p_ends_at or p_effective_from>p_effective_to then raise exception 'The timetable period is invalid.';end if;
  if exists(select 1 from public.dreem_timetable_entries e where e.school_id=v_assignment.school_id and e.term_id=v_assignment.term_id and e.weekday=p_weekday and e.status<>'cancelled' and daterange(e.effective_from,e.effective_to,'[]') && daterange(p_effective_from,p_effective_to,'[]') and e.starts_at<p_ends_at and p_starts_at<e.ends_at and (e.teacher_user_id=v_assignment.teacher_user_id or e.class_id=v_assignment.class_id)) then raise exception 'This period conflicts with the teacher or class timetable.';end if;
  insert into public.dreem_timetable_entries(school_id,term_id,teaching_assignment_id,class_id,subject_id,teacher_user_id,weekday,starts_at,ends_at,room,effective_from,effective_to,status,idempotency_key,created_by)
  values(v_assignment.school_id,v_assignment.term_id,v_assignment.id,v_assignment.class_id,v_assignment.subject_id,v_assignment.teacher_user_id,p_weekday,p_starts_at,p_ends_at,nullif(trim(p_room),''),p_effective_from,p_effective_to,'active',p_idempotency_key,v_actor) returning id,status into v_id,v_status;
  perform private.dreem_write_event(v_assignment.school_id,'timetable_entry',v_id,'timetable.scheduled',concat('timetable.scheduled:',p_idempotency_key),jsonb_build_object('assignment_id',v_assignment.id,'weekday',p_weekday,'starts_at',p_starts_at));
  entry_id:=v_id;entry_status:=v_status;return next;
end;$$;

create or replace function public.dreem_review_assessment(p_assessment_id uuid,p_decision text,p_note text,p_idempotency_key text)
returns table(assessment_id uuid,assessment_status text)
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid());v_assessment public.dreem_assessments%rowtype;v_existing public.dreem_assessment_reviews%rowtype;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  select * into v_assessment from public.dreem_assessments where id=p_assessment_id for update;
  if not found or not private.dreem_has_role(v_assessment.school_id,array['leadership','academic_head']) then raise exception 'Independent academic review authorization is required.';end if;
  select * into v_existing from public.dreem_assessment_reviews where school_id=v_assessment.school_id and idempotency_key=p_idempotency_key;
  if found then assessment_id:=v_assessment.id;assessment_status:=v_assessment.status;return next;return;end if;
  if v_assessment.created_by=v_actor then raise exception 'Assessment authors cannot approve their own evidence.';end if;
  if v_assessment.status<>'submitted' then raise exception 'Only submitted assessments can be reviewed.';end if;
  if p_decision not in ('approved','rejected') then raise exception 'Review decision must be approved or rejected.';end if;
  if char_length(trim(coalesce(p_note,'')))<5 then raise exception 'A review note is required.';end if;
  if not exists(select 1 from public.dreem_marks m where m.assessment_id=v_assessment.id) then raise exception 'An assessment without marks cannot be approved.';end if;
  insert into public.dreem_assessment_reviews(school_id,assessment_id,decision,note,reviewer_user_id,idempotency_key) values(v_assessment.school_id,v_assessment.id,p_decision,trim(p_note),v_actor,p_idempotency_key);
  update public.dreem_assessments set status=p_decision,approved_by=case when p_decision='approved' then v_actor end,approved_at=case when p_decision='approved' then now() end,updated_at=now() where id=v_assessment.id returning id,status into assessment_id,assessment_status;
  perform private.dreem_write_event(v_assessment.school_id,'assessment',v_assessment.id,concat('assessment.',p_decision),concat('assessment.reviewed:',p_idempotency_key),jsonb_build_object('decision',p_decision,'note',trim(p_note)));
  return next;
end;$$;

create or replace function public.dreem_generate_report_card(p_student_id uuid,p_term_id uuid,p_teacher_comment text,p_idempotency_key text)
returns table(report_card_id uuid,report_status text,evidence_count integer,overall_average numeric)
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid());v_school uuid;v_student public.students%rowtype;v_existing public.dreem_report_cards%rowtype;v_id uuid;v_revision integer;v_count integer;v_average numeric;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  select * into v_student from public.students where id=p_student_id;
  if not found or not private.dreem_has_role(v_student.school_id,array['leadership','academic_head','teacher']) then raise exception 'Academic reporting authorization is required.';end if;
  v_school:=v_student.school_id;
  select * into v_existing from public.dreem_report_cards where school_id=v_school and idempotency_key=p_idempotency_key;
  if found then report_card_id:=v_existing.id;report_status:=v_existing.status;evidence_count:=v_existing.evidence_count;overall_average:=v_existing.overall_average;return next;return;end if;
  if not exists(select 1 from public.dreem_terms t where t.id=p_term_id and t.school_id=v_school) then raise exception 'Term does not belong to this school.';end if;
  select count(*),round(avg(m.score/a.max_score*100),2) into v_count,v_average from public.dreem_marks m join public.dreem_assessments a on a.id=m.assessment_id where m.student_id=p_student_id and a.school_id=v_school and a.term_id=p_term_id and a.status='published';
  if v_count=0 then raise exception 'No published assessment evidence exists for this learner and term.';end if;
  select coalesce(max(revision),0)+1 into v_revision from public.dreem_report_cards where student_id=p_student_id and term_id=p_term_id;
  update public.dreem_report_cards set status='superseded' where student_id=p_student_id and term_id=p_term_id and status='draft';
  insert into public.dreem_report_cards(school_id,term_id,student_id,status,revision,overall_average,evidence_count,teacher_comment,generated_by,idempotency_key) values(v_school,p_term_id,p_student_id,'draft',v_revision,v_average,v_count,nullif(trim(p_teacher_comment),''),v_actor,p_idempotency_key) returning id into v_id;
  insert into public.dreem_report_card_results(school_id,report_card_id,subject_id,subject_name,average_percent,assessment_count)
  select v_school,v_id,a.subject_id,coalesce(s.name,'Unassigned subject'),round(avg(m.score/a.max_score*100),2),count(distinct a.id) from public.dreem_marks m join public.dreem_assessments a on a.id=m.assessment_id left join public.dreem_subjects s on s.id=a.subject_id where m.student_id=p_student_id and a.school_id=v_school and a.term_id=p_term_id and a.status='published' group by a.subject_id,s.name;
  perform private.dreem_write_event(v_school,'report_card',v_id,'report_card.generated',concat('report_card.generated:',p_idempotency_key),jsonb_build_object('student_id',p_student_id,'term_id',p_term_id,'evidence_count',v_count,'revision',v_revision));
  report_card_id:=v_id;report_status:='draft';evidence_count:=v_count;overall_average:=v_average;return next;
end;$$;
