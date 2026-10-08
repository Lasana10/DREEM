create or replace function public.dreem_record_attendance(
  p_class_name text,
  p_session_date date,
  p_period_label text,
  p_marks jsonb,
  p_idempotency_key text
) returns table(session_id uuid, recorded_count integer)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_actor uuid:=(select auth.uid());
  v_school_id uuid;
  v_session_id uuid;
  v_count integer;
  v_is_academic_admin boolean;
  v_is_assigned_teacher boolean;
begin
  if v_actor is null then raise exception 'Authentication is required.'; end if;
  if nullif(trim(p_class_name),'') is null or p_session_date is null then raise exception 'Class and attendance date are required.'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'An idempotency key is required.'; end if;

  v_school_id:=private.dreem_active_school_for_role(array['platform_founder','school_owner','principal','academic_head','teacher']);
  if v_school_id is null then raise exception 'You are not authorized to record attendance.'; end if;

  v_is_academic_admin:=private.dreem_has_role(v_school_id,array['platform_founder','school_owner','principal','academic_head']);
  select exists(
    select 1
    from public.dreem_teaching_assignments ta
    join public.dreem_classes c on c.id=ta.class_id and c.school_id=ta.school_id
    where ta.school_id=v_school_id
      and ta.teacher_user_id=v_actor
      and ta.status in ('planned','active')
      and lower(trim(c.name))=lower(trim(p_class_name))
  ) into v_is_assigned_teacher;

  if not v_is_academic_admin and not v_is_assigned_teacher then
    raise exception 'Teachers may record attendance only for an assigned class.';
  end if;

  insert into public.dreem_attendance_sessions(school_id,class_name,session_date,period_label,captured_by,idempotency_key)
  values(v_school_id,trim(p_class_name),p_session_date,coalesce(nullif(trim(p_period_label),''),'AM'),v_actor,p_idempotency_key)
  on conflict(school_id,idempotency_key) do update set updated_at=now()
  returning id into v_session_id;

  insert into public.dreem_attendance_marks(school_id,session_id,student_id,status,note,recorded_by)
  select v_school_id,v_session_id,(mark->>'student_id')::uuid,mark->>'status',nullif(mark->>'note',''),v_actor
  from jsonb_array_elements(coalesce(p_marks,'[]'::jsonb)) mark
  join public.students s
    on s.id=(mark->>'student_id')::uuid
   and s.school_id=v_school_id
   and lower(trim(coalesce(s.class_name,'')))=lower(trim(p_class_name))
  where mark->>'status' in('present','late','absent','excused')
  on conflict on constraint dreem_attendance_marks_session_id_student_id_key
  do update set status=excluded.status,note=excluded.note;

  select count(*) into v_count
  from public.dreem_attendance_marks am
  where am.session_id=v_session_id;

  if v_count=0 then raise exception 'No valid learners from this class were supplied.'; end if;

  perform private.dreem_write_event(
    v_school_id,'attendance_session',v_session_id,'attendance.submitted',
    concat('attendance.submitted:',p_idempotency_key),
    jsonb_build_object('class_name',trim(p_class_name),'recorded_count',v_count)
  );

  session_id:=v_session_id;
  recorded_count:=v_count;
  return next;
end;
$$;

revoke all on function public.dreem_record_attendance(text,date,text,jsonb,text) from public,anon;
grant execute on function public.dreem_record_attendance(text,date,text,jsonb,text) to authenticated;