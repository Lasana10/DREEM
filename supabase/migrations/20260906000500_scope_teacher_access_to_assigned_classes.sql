create or replace function private.dreem_can_view_student(p_school_id uuid,p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select (select auth.uid()) is not null and (
    private.dreem_has_role(p_school_id,array['leadership','support','bursar'])
    or exists(
      select 1 from public.students s
      join public.dreem_classes c on c.school_id=s.school_id and lower(c.name)=lower(coalesce(s.class_name,''))
      join public.dreem_teaching_assignments ta on ta.school_id=s.school_id and ta.class_id=c.id
      where s.id=p_student_id and s.school_id=p_school_id and ta.teacher_user_id=(select auth.uid()) and ta.status in ('planned','active')
    )
    or exists(
      select 1 from public.students s
      where s.id=p_student_id and s.school_id=p_school_id and (s.profile_id=(select auth.uid()) or (select auth.uid())=any(coalesce(s.parent_user_ids,array[]::uuid[])))
    )
  );
$function$;

create or replace function public.dreem_record_attendance(p_class_name text,p_session_date date,p_period_label text,p_marks jsonb,p_idempotency_key text)
returns table(session_id uuid,recorded_count integer)
language plpgsql security definer set search_path to ''
as $function$
declare v_actor uuid:=(select auth.uid());v_school_id uuid;v_session_id uuid;v_count integer;v_is_academic_admin boolean;v_is_assigned_teacher boolean;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  if nullif(trim(p_class_name),'') is null or p_session_date is null then raise exception 'Class and attendance date are required.';end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'An idempotency key is required.';end if;
  v_school_id:=private.dreem_active_school_for_role(array['platform_founder','school_owner','principal','academic_head','teacher']);
  if v_school_id is null then raise exception 'You are not authorized to record attendance.';end if;
  v_is_academic_admin:=private.dreem_has_role(v_school_id,array['platform_founder','school_owner','principal','academic_head']);
  select exists(select 1 from public.dreem_teaching_assignments ta join public.dreem_classes c on c.id=ta.class_id and c.school_id=ta.school_id where ta.school_id=v_school_id and ta.teacher_user_id=v_actor and ta.status in ('planned','active') and lower(c.name)=lower(trim(p_class_name))) into v_is_assigned_teacher;
  if not v_is_academic_admin and not v_is_assigned_teacher then raise exception 'Teachers may record attendance only for an assigned class.';end if;
  insert into public.dreem_attendance_sessions(school_id,class_name,session_date,period_label,captured_by,idempotency_key) values(v_school_id,trim(p_class_name),p_session_date,coalesce(nullif(trim(p_period_label),''),'AM'),v_actor,p_idempotency_key) on conflict(school_id,idempotency_key) do update set updated_at=now() returning id into v_session_id;
  insert into public.dreem_attendance_marks(school_id,session_id,student_id,status,note,recorded_by)
  select v_school_id,v_session_id,(mark->>'student_id')::uuid,mark->>'status',nullif(mark->>'note',''),v_actor from jsonb_array_elements(coalesce(p_marks,'[]'::jsonb)) mark join public.students s on s.id=(mark->>'student_id')::uuid and s.school_id=v_school_id and lower(coalesce(s.class_name,''))=lower(trim(p_class_name)) where mark->>'status' in('present','late','absent','excused') on conflict on constraint dreem_attendance_marks_session_id_student_id_key do update set status=excluded.status,note=excluded.note;
  select count(*) into v_count from public.dreem_attendance_marks am where am.session_id=v_session_id;
  if v_count=0 then raise exception 'No valid learners from this class were supplied.';end if;
  perform private.dreem_write_event(v_school_id,'attendance_session',v_session_id,'attendance.submitted',concat('attendance.submitted:',p_idempotency_key),jsonb_build_object('class_name',p_class_name,'recorded_count',v_count));
  session_id:=v_session_id;recorded_count:=v_count;return next;
end;$function$;

create or replace function public.dreem_record_assessment(p_subject_id uuid,p_class_name text,p_title text,p_max_score numeric,p_assessment_date date,p_marks jsonb,p_idempotency_key text)
returns table(assessment_id uuid,marks_count integer)
language plpgsql security definer set search_path to ''
as $function$
declare v_actor uuid:=(select auth.uid());v_school uuid;v_id uuid;v_count integer;v_average numeric;v_term uuid;v_assignment uuid;v_is_academic_admin boolean;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  v_school:=private.dreem_active_school_for_role(array['platform_founder','school_owner','principal','academic_head','teacher']);
  if v_school is null then raise exception 'You are not authorized to record assessments.';end if;
  if p_max_score is null or p_max_score<=0 or nullif(trim(p_class_name),'') is null then raise exception 'Class and a positive maximum score are required.';end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'An idempotency key is required.';end if;
  select t.id into v_term from public.dreem_terms t where t.school_id=v_school and p_assessment_date between t.starts_on and t.ends_on order by t.order_index limit 1;
  if v_term is null then raise exception 'Assessment date must belong to a configured term.';end if;
  select ta.id into v_assignment from public.dreem_teaching_assignments ta join public.dreem_classes c on c.id=ta.class_id where ta.school_id=v_school and ta.term_id=v_term and ta.subject_id=p_subject_id and lower(c.name)=lower(trim(p_class_name)) and ta.teacher_user_id=v_actor and ta.status='active' limit 1;
  v_is_academic_admin:=private.dreem_has_role(v_school,array['platform_founder','school_owner','principal','academic_head']);
  if v_assignment is null and not v_is_academic_admin then raise exception 'Only the assigned teacher can submit this assessment.';end if;
  insert into public.dreem_assessments(school_id,subject_id,class_name,title,max_score,assessment_date,status,created_by,idempotency_key,term_id,teaching_assignment_id) values(v_school,p_subject_id,trim(p_class_name),trim(p_title),p_max_score,p_assessment_date,'submitted',v_actor,p_idempotency_key,v_term,v_assignment) on conflict(school_id,idempotency_key) do update set updated_at=now() returning id into v_id;
  insert into public.dreem_marks(school_id,assessment_id,student_id,score,comment,recorded_by) select v_school,v_id,(mark->>'student_id')::uuid,(mark->>'score')::numeric,nullif(mark->>'comment',''),v_actor from jsonb_array_elements(coalesce(p_marks,'[]'::jsonb)) mark join public.students s on s.id=(mark->>'student_id')::uuid and s.school_id=v_school and lower(coalesce(s.class_name,''))=lower(trim(p_class_name)) where (mark->>'score')::numeric between 0 and p_max_score on conflict(assessment_id,student_id) do update set score=excluded.score,comment=excluded.comment;
  select count(*),avg(score/p_max_score*100) into v_count,v_average from public.dreem_marks where assessment_id=v_id;
  if v_count=0 then raise exception 'No valid learner marks from this class were supplied.';end if;
  perform private.dreem_write_event(v_school,'assessment',v_id,'assessment.submitted',concat('assessment.submitted:',p_idempotency_key),jsonb_build_object('class_name',p_class_name,'term_id',v_term,'teaching_assignment_id',v_assignment,'marks_count',v_count,'average',v_average));
  assessment_id:=v_id;marks_count:=v_count;return next;
end;$function$;

create or replace function public.dreem_record_assessment_v2(p_subject_id uuid,p_class_name text,p_title text,p_assessment_type text,p_max_score numeric,p_assessment_date date,p_duration_minutes integer,p_paper_reference text,p_question_summary text,p_marking_guide text,p_syllabus_objectives text,p_marks jsonb,p_idempotency_key text)
returns table(assessment_id uuid,marks_count integer)
language plpgsql security definer set search_path to ''
as $function$
declare v_actor uuid:=(select auth.uid());v_school uuid;v_id uuid;v_count integer;v_term uuid;v_assignment uuid;v_is_academic_admin boolean;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  v_school:=private.dreem_active_school_for_role(array['platform_founder','school_owner','principal','academic_head','teacher']);
  if v_school is null or p_max_score<=0 then raise exception 'Assessment authorization and a positive maximum score are required.';end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'An idempotency key is required.';end if;
  select t.id into v_term from public.dreem_terms t where t.school_id=v_school and p_assessment_date between t.starts_on and t.ends_on order by t.order_index limit 1;
  if v_term is null then raise exception 'Assessment date must belong to a configured term.';end if;
  select ta.id into v_assignment from public.dreem_teaching_assignments ta join public.dreem_classes c on c.id=ta.class_id where ta.school_id=v_school and ta.term_id=v_term and ta.subject_id=p_subject_id and lower(c.name)=lower(trim(p_class_name)) and ta.teacher_user_id=v_actor and ta.status='active' limit 1;
  v_is_academic_admin:=private.dreem_has_role(v_school,array['platform_founder','school_owner','principal','academic_head']);
  if v_assignment is null and not v_is_academic_admin then raise exception 'Only the assigned teacher can submit this assessment.';end if;
  insert into public.dreem_assessments(school_id,subject_id,class_name,title,assessment_type,max_score,assessment_date,duration_minutes,paper_reference,question_summary,marking_guide,syllabus_objectives,status,created_by,idempotency_key,term_id,teaching_assignment_id) values(v_school,p_subject_id,trim(p_class_name),trim(p_title),p_assessment_type,p_max_score,p_assessment_date,p_duration_minutes,nullif(trim(p_paper_reference),''),nullif(trim(p_question_summary),''),nullif(trim(p_marking_guide),''),nullif(trim(p_syllabus_objectives),''),'submitted',v_actor,p_idempotency_key,v_term,v_assignment) on conflict(school_id,idempotency_key) do update set updated_at=now() returning id into v_id;
  insert into public.dreem_marks(school_id,assessment_id,student_id,score,comment,recorded_by) select v_school,v_id,(m->>'student_id')::uuid,(m->>'score')::numeric,nullif(m->>'comment',''),v_actor from jsonb_array_elements(coalesce(p_marks,'[]'::jsonb)) m join public.students s on s.id=(m->>'student_id')::uuid and s.school_id=v_school and lower(coalesce(s.class_name,''))=lower(trim(p_class_name)) where (m->>'score')::numeric between 0 and p_max_score on conflict(assessment_id,student_id) do update set score=excluded.score,comment=excluded.comment;
  select count(*) into v_count from public.dreem_marks where assessment_id=v_id;
  if v_count=0 then raise exception 'No valid learner marks from this class were supplied.';end if;
  perform private.dreem_write_event(v_school,'assessment',v_id,'assessment.submitted','assessment.submitted:'||p_idempotency_key,jsonb_build_object('type',p_assessment_type,'marks_count',v_count,'objectives',p_syllabus_objectives));
  assessment_id:=v_id;marks_count:=v_count;return next;
end;$function$;

create or replace function public.dreem_generate_report_card(p_student_id uuid,p_term_id uuid,p_teacher_comment text,p_idempotency_key text)
returns table(report_card_id uuid,report_status text,evidence_count integer,overall_average numeric)
language plpgsql security definer set search_path to ''
as $function$
declare v_actor uuid:=(select auth.uid());v_school uuid;v_student public.students%rowtype;v_existing public.dreem_report_cards%rowtype;v_id uuid;v_revision integer;v_count integer;v_average numeric;v_is_academic_admin boolean;v_is_assigned_teacher boolean;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  select * into v_student from public.students where id=p_student_id;if not found then raise exception 'Learner was not found.';end if;
  v_school:=v_student.school_id;v_is_academic_admin:=private.dreem_has_role(v_school,array['platform_founder','school_owner','principal','academic_head']);
  select exists(select 1 from public.dreem_teaching_assignments ta join public.dreem_classes c on c.id=ta.class_id where ta.school_id=v_school and ta.term_id=p_term_id and ta.teacher_user_id=v_actor and ta.status in ('planned','active') and lower(c.name)=lower(coalesce(v_student.class_name,''))) into v_is_assigned_teacher;
  if not v_is_academic_admin and not v_is_assigned_teacher then raise exception 'Teachers may generate reports only for learners in their assigned classes.';end if;
  select * into v_existing from public.dreem_report_cards where school_id=v_school and idempotency_key=p_idempotency_key;if found then report_card_id:=v_existing.id;report_status:=v_existing.status;evidence_count:=v_existing.evidence_count;overall_average:=v_existing.overall_average;return next;return;end if;
  if not exists(select 1 from public.dreem_terms t where t.id=p_term_id and t.school_id=v_school) then raise exception 'Term does not belong to this school.';end if;
  select count(*),round(avg(m.score/a.max_score*100),2) into v_count,v_average from public.dreem_marks m join public.dreem_assessments a on a.id=m.assessment_id where m.student_id=p_student_id and a.school_id=v_school and a.term_id=p_term_id and a.status='published';if v_count=0 then raise exception 'No published assessment evidence exists for this learner and term.';end if;
  select coalesce(max(revision),0)+1 into v_revision from public.dreem_report_cards where student_id=p_student_id and term_id=p_term_id;update public.dreem_report_cards set status='superseded' where student_id=p_student_id and term_id=p_term_id and status='draft';
  insert into public.dreem_report_cards(school_id,term_id,student_id,status,revision,overall_average,evidence_count,teacher_comment,generated_by,idempotency_key) values(v_school,p_term_id,p_student_id,'draft',v_revision,v_average,v_count,nullif(trim(p_teacher_comment),''),v_actor,p_idempotency_key) returning id into v_id;
  insert into public.dreem_report_card_results(school_id,report_card_id,subject_id,subject_name,average_percent,assessment_count) select v_school,v_id,a.subject_id,coalesce(s.name,'Unassigned subject'),round(avg(m.score/a.max_score*100),2),count(distinct a.id) from public.dreem_marks m join public.dreem_assessments a on a.id=m.assessment_id left join public.dreem_subjects s on s.id=a.subject_id where m.student_id=p_student_id and a.school_id=v_school and a.term_id=p_term_id and a.status='published' group by a.subject_id,s.name;
  perform private.dreem_write_event(v_school,'report_card',v_id,'report_card.generated',concat('report_card.generated:',p_idempotency_key),jsonb_build_object('student_id',p_student_id,'term_id',p_term_id,'evidence_count',v_count,'revision',v_revision));report_card_id:=v_id;report_status:='draft';evidence_count:=v_count;overall_average:=v_average;return next;
end;$function$;

revoke all on function public.dreem_record_attendance(text,date,text,jsonb,text) from public,anon;
revoke all on function public.dreem_record_assessment(uuid,text,text,numeric,date,jsonb,text) from public,anon;
revoke all on function public.dreem_record_assessment_v2(uuid,text,text,text,numeric,date,integer,text,text,text,text,jsonb,text) from public,anon;
revoke all on function public.dreem_generate_report_card(uuid,uuid,text,text) from public,anon;
grant execute on function public.dreem_record_attendance(text,date,text,jsonb,text) to authenticated,service_role;
grant execute on function public.dreem_record_assessment(uuid,text,text,numeric,date,jsonb,text) to authenticated,service_role;
grant execute on function public.dreem_record_assessment_v2(uuid,text,text,text,numeric,date,integer,text,text,text,text,jsonb,text) to authenticated,service_role;
grant execute on function public.dreem_generate_report_card(uuid,uuid,text,text) to authenticated,service_role;