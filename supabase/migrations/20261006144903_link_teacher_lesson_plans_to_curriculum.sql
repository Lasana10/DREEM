create or replace function public.dreem_record_lesson_plan_with_outcomes(
  p_assignment_id uuid,
  p_lesson_date date,
  p_title text,
  p_objectives text,
  p_learning_activity text,
  p_evidence text,
  p_follow_up text,
  p_outcome_ids uuid[],
  p_idempotency_key text
) returns table(lesson_plan_id uuid, lesson_plan_status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_assignment public.dreem_teaching_assignments%rowtype;
  v_plan_id uuid;
  v_status text;
  v_outcome uuid;
begin
  select * into v_assignment
  from public.dreem_teaching_assignments
  where id=p_assignment_id and status='active';
  if not found then raise exception 'Active teaching assignment is required.'; end if;

  if coalesce(array_length(p_outcome_ids,1),0)=0 then
    raise exception 'Choose at least one curriculum outcome for this lesson.';
  end if;

  foreach v_outcome in array p_outcome_ids loop
    if not exists(
      select 1
      from public.dreem_curriculum_outcomes o
      where o.id=v_outcome
        and o.school_id=v_assignment.school_id
        and o.academic_year_id=v_assignment.academic_year_id
        and o.class_id=v_assignment.class_id
        and o.subject_id=v_assignment.subject_id
        and o.status='active'
    ) then
      raise exception 'One or more selected curriculum outcomes do not belong to this active teaching assignment.';
    end if;
  end loop;

  select x.lesson_plan_id,x.lesson_plan_status into v_plan_id,v_status
  from public.dreem_record_lesson_plan(
    p_assignment_id,p_lesson_date,p_title,p_objectives,p_learning_activity,p_evidence,p_follow_up,p_idempotency_key
  ) x limit 1;

  insert into public.dreem_lesson_plan_outcomes(lesson_plan_id,outcome_id)
  select v_plan_id,unnest(p_outcome_ids)
  on conflict do nothing;

  lesson_plan_id:=v_plan_id;
  lesson_plan_status:=v_status;
  return next;
end;
$$;

revoke all on function public.dreem_record_lesson_plan_with_outcomes(uuid,date,text,text,text,text,text,uuid[],text) from public,anon;
grant execute on function public.dreem_record_lesson_plan_with_outcomes(uuid,date,text,text,text,text,text,uuid[],text) to authenticated;
