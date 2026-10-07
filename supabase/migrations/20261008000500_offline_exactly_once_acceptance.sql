do $$
declare
  v_school uuid; v_teacher uuid; v_class text; v_operation uuid:=gen_random_uuid(); v_key text:='acceptance-offline-'||gen_random_uuid()::text;
  v_payload jsonb; v_first jsonb; v_second jsonb; v_receipts integer; v_sessions integer; v_pass boolean:=false;
begin
  select m.school_id,m.profile_id,c.name into v_school,v_teacher,v_class
  from public.dreem_school_memberships m
  join public.dreem_teaching_assignments ta on ta.school_id=m.school_id and ta.teacher_user_id=m.profile_id and ta.status='active'
  join public.dreem_classes c on c.id=ta.class_id
  where m.role='teacher' and m.status='approved'
  limit 1;

  if v_school is null or v_teacher is null or v_class is null then
    insert into public.dreem_acceptance_evidence(school_id,scenario,status,detail,source)
    values(v_school,'offline_exactly_once_replay','blocked',jsonb_build_object('reason','Approved teacher with active assignment unavailable'),'20261008000500_offline_exactly_once_acceptance');
    return;
  end if;

  begin
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_teacher::text,'role','authenticated')::text,true);
    v_payload:=jsonb_build_object(
      'className',v_class,'sessionDate',current_date::text,'periodLabel','ACCEPTANCE',
      'marks','[]'::jsonb,'idempotencyKey',v_key
    );

    v_first:=public.dreem_ingest_teacher_offline_operation(
      v_operation,v_school,'acceptance-device','teacher.record_attendance',v_payload,repeat('a',64),now(),v_key
    );
    v_second:=public.dreem_ingest_teacher_offline_operation(
      v_operation,v_school,'acceptance-device','teacher.record_attendance',v_payload,repeat('a',64),now(),v_key
    );

    if coalesce((v_first->>'accepted')::boolean,false)<>true or coalesce((v_first->>'duplicate')::boolean,true)<>false then
      raise exception 'first replay was not accepted exactly once';
    end if;
    if coalesce((v_second->>'accepted')::boolean,false)<>true or coalesce((v_second->>'duplicate')::boolean,false)<>true then
      raise exception 'duplicate replay was not recognized';
    end if;

    select count(*) into v_receipts from public.dreem_offline_operation_receipts where operation_id=v_operation;
    select count(*) into v_sessions from public.dreem_attendance_sessions where idempotency_key=v_key;
    if v_receipts<>1 or v_sessions<>1 then
      raise exception 'exactly-once assertion failed: receipts %, sessions %',v_receipts,v_sessions;
    end if;

    v_pass:=true;
    raise exception using errcode='P0001',message='DREEM_ACCEPTANCE_ROLLBACK';
  exception when sqlstate 'P0001' then
    if sqlerrm<>'DREEM_ACCEPTANCE_ROLLBACK' then raise; end if;
  end;

  if v_pass then
    insert into public.dreem_acceptance_evidence(school_id,scenario,status,detail,source)
    values(v_school,'offline_exactly_once_replay','passed',
      jsonb_build_object('first_accept',true,'duplicate_detected',true,'receipt_count',v_receipts,'downstream_session_count',v_sessions,'fixture_rolled_back',true),
      '20261008000500_offline_exactly_once_acceptance');
  end if;
end $$;