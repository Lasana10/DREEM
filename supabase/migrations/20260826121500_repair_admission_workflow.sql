-- Repair the admission decision transaction without weakening RLS or grants.

create or replace function public.dreem_progress_admission_application(
  p_application_id uuid,
  p_target_status text,
  p_note text,
  p_assigned_to uuid,
  p_opening_balance numeric,
  p_idempotency_key text
) returns table(application_id uuid,application_status text,enrolled_student_id uuid,matricule text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_app public.dreem_admission_applications%rowtype;
  v_event text;
  v_student uuid;
  v_guardian uuid;
  v_matricule text;
  v_prefix text;
begin
  if v_actor is null then
    raise exception 'Authentication is required.';
  end if;
  if p_application_id is null then
    raise exception 'An application must be selected.';
  end if;
  if nullif(trim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'An idempotency key is required.';
  end if;
  if p_target_status not in ('under_review','documents_pending','interview','offered','accepted','waitlisted','rejected','withdrawn','enrolled') then
    raise exception 'Unsupported admission status.';
  end if;
  if char_length(trim(coalesce(p_note,''))) < 2 then
    raise exception 'A decision or action note is required.';
  end if;
  if coalesce(p_opening_balance,0) < 0 then
    raise exception 'Opening balance cannot be negative.';
  end if;

  select a.*
    into v_app
    from public.dreem_admission_applications as a
   where a.id = p_application_id
   for update;

  if not found or not private.dreem_has_role(v_app.school_id,array['leadership','administrator','academic_head']) then
    raise exception 'You are not authorized to progress this application.';
  end if;

  -- A repeated command must return the already committed result, including after
  -- enrolment moved the application into a terminal state.
  if exists (
    select 1
      from public.dreem_domain_events as e
     where e.school_id = v_app.school_id
       and e.idempotency_key = concat('admission.progressed:',p_idempotency_key)
  ) then
    application_id := v_app.id;
    application_status := v_app.status;
    enrolled_student_id := v_app.enrolled_student_id;
    select s.matricule into matricule
      from public.students as s
     where s.id = v_app.enrolled_student_id;
    return next;
    return;
  end if;

  if v_app.status in ('rejected','withdrawn','enrolled') then
    raise exception 'This application is already in a terminal state.';
  end if;
  if p_target_status = v_app.status then
    raise exception 'The application is already in the selected state.';
  end if;
  if not (case v_app.status
    when 'submitted' then p_target_status in ('under_review','documents_pending','interview','waitlisted','rejected','withdrawn')
    when 'under_review' then p_target_status in ('documents_pending','interview','offered','waitlisted','rejected','withdrawn')
    when 'documents_pending' then p_target_status in ('under_review','interview','offered','waitlisted','rejected','withdrawn')
    when 'interview' then p_target_status in ('under_review','documents_pending','offered','waitlisted','rejected','withdrawn')
    when 'offered' then p_target_status in ('accepted','rejected','withdrawn')
    when 'accepted' then p_target_status in ('enrolled','withdrawn')
    when 'waitlisted' then p_target_status in ('under_review','offered','rejected','withdrawn')
    else false
  end) then
    raise exception 'Invalid admission transition from % to %.', v_app.status, p_target_status;
  end if;
  if p_assigned_to is not null and not exists (
    select 1
      from public.dreem_school_memberships as m
     where m.school_id = v_app.school_id
       and m.profile_id = p_assigned_to
       and m.status = 'approved'
       and m.role not in ('parent','student')
  ) then
    raise exception 'Assignee is not an approved staff member of this school.';
  end if;

  if p_target_status = 'enrolled' then
    select coalesce(nullif(trim(b.student_id_prefix),''),'DRM')
      into v_prefix
      from public.dreem_school_brands as b
     where b.school_id = v_app.school_id;
    v_prefix := coalesce(v_prefix,'DRM');

    loop
      v_matricule := concat(v_prefix,'-',to_char(now(),'YY'),'-',upper(substr(replace(gen_random_uuid()::text,'-',''),1,5)));
      exit when not exists (
        select 1 from public.students as s
         where s.school_id = v_app.school_id and s.matricule = v_matricule
      );
    end loop;

    insert into public.students as s
      (school_id,matricule,full_name,class_name,date_of_birth,sex,guardian_contact)
    values
      (v_app.school_id,v_matricule,v_app.learner_full_name,v_app.target_class_name,v_app.date_of_birth,v_app.sex,v_app.guardian_phone)
    returning s.id into v_student;

    insert into public.dreem_guardians as g
      (school_id,full_name,phone,email)
    values
      (v_app.school_id,v_app.guardian_full_name,v_app.guardian_phone,v_app.guardian_email)
    returning g.id into v_guardian;

    insert into public.dreem_student_guardians as sg
      (school_id,student_id,guardian_id,relationship,is_primary)
    values
      (v_app.school_id,v_student,v_guardian,v_app.guardian_relationship,true);

    insert into public.fee_accounts as f
      (school_id,student_id,amount_due,amount_paid,balance_due,status)
    values
      (v_app.school_id,v_student,coalesce(p_opening_balance,0),0,coalesce(p_opening_balance,0),
       case when coalesce(p_opening_balance,0) = 0 then 'clear' else 'open' end);
  end if;

  v_event := case p_target_status
    when 'under_review' then 'review_started'
    when 'documents_pending' then 'documents_requested'
    when 'interview' then 'interview_scheduled'
    else p_target_status
  end;

  update public.dreem_admission_applications as a
     set status = p_target_status,
         assigned_to = coalesce(p_assigned_to,a.assigned_to),
         enrolled_student_id = coalesce(v_student,a.enrolled_student_id),
         decided_at = case
           when p_target_status in ('offered','accepted','waitlisted','rejected','withdrawn','enrolled') then now()
           else a.decided_at
         end,
         updated_at = now()
   where a.id = v_app.id
  returning a.id,a.status,a.enrolled_student_id
       into application_id,application_status,enrolled_student_id;

  insert into public.dreem_admission_events as ae
    (school_id,application_id,event_type,from_status,to_status,note,actor_user_id)
  values
    (v_app.school_id,v_app.id,v_event,v_app.status,p_target_status,trim(p_note),v_actor);

  perform private.dreem_write_event(
    v_app.school_id,'admission_application',v_app.id,'admission.progressed',
    concat('admission.progressed:',p_idempotency_key),
    jsonb_build_object('from_status',v_app.status,'to_status',p_target_status,'student_id',v_student)
  );

  matricule := v_matricule;
  return next;
end;
$$;

revoke all on function public.dreem_progress_admission_application(uuid,text,text,uuid,numeric,text) from public,anon,authenticated;
grant execute on function public.dreem_progress_admission_application(uuid,text,text,uuid,numeric,text) to authenticated;
