do $$
declare
  v_school uuid; v_teacher uuid; v_membership uuid; v_class text; v_student uuid;
  v_blocked boolean:=false; v_session_count integer:=0; v_pass boolean:=false; v_key text:='suspend-accept-'||gen_random_uuid()::text;
begin
  select m.school_id,m.profile_id,m.id,c.name
    into v_school,v_teacher,v_membership,v_class
  from public.dreem_school_memberships m
  join public.dreem_teaching_assignments ta on ta.school_id=m.school_id and ta.teacher_user_id=m.profile_id and ta.status='active'
  join public.dreem_classes c on c.id=ta.class_id
  where m.role='teacher' and m.status='approved'
  limit 1;

  if v_school is null or v_teacher is null then
    insert into public.dreem_acceptance_evidence(school_id,scenario,status,detail,source)
    values(v_school,'suspended_staff_new_action_denied','blocked',jsonb_build_object('reason','Approved teacher assignment unavailable'),'20261008001050_suspended_staff_acceptance');
    return;
  end if;

  begin
    insert into public.students(school_id,matricule,full_name,class_name)
    values(v_school,'SUSPEND-ACCEPT-'||substr(gen_random_uuid()::text,1,8),'Suspension Acceptance Learner',trim(v_class))
    returning id into v_student;

    update public.dreem_school_memberships set status='suspended' where id=v_membership;
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_teacher::text,'role','authenticated')::text,true);

    begin
      perform *
      from public.dreem_record_attendance(
        trim(v_class),current_date,'SUSPENSION-ACCEPTANCE',
        jsonb_build_array(jsonb_build_object('student_id',v_student,'status','present')),
        v_key
      );
    exception when others then
      if position('not authorized' in lower(sqlerrm))>0 or position('assigned class' in lower(sqlerrm))>0 then
        v_blocked:=true;
      else
        raise;
      end if;
    end;

    select count(*) into v_session_count
    from public.dreem_attendance_sessions
    where idempotency_key=v_key;

    if not v_blocked or v_session_count<>0 then
      raise exception 'Suspended staff action was not safely denied';
    end if;

    v_pass:=true;
    raise exception using errcode='P0001',message='DREEM_ACCEPTANCE_ROLLBACK';
  exception when sqlstate 'P0001' then
    if sqlerrm<>'DREEM_ACCEPTANCE_ROLLBACK' then raise; end if;
  end;

  if v_pass then
    insert into public.dreem_acceptance_evidence(school_id,scenario,status,detail,source)
    values(v_school,'suspended_staff_new_action_denied','passed',
      jsonb_build_object('membership_suspended',true,'new_attendance_blocked',true,'false_success_records',v_session_count,'fixture_rolled_back',true),
      '20261008001050_suspended_staff_acceptance');
  end if;
end $$;