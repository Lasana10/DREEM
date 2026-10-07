do $$
declare
  v_school uuid; v_founder uuid; v_gate_user uuid; v_gate_membership uuid;
  v_student uuid; v_credential uuid; v_token text; v_blocked boolean:=false; v_events integer:=0; v_pass boolean:=false;
begin
  select m.school_id,m.profile_id into v_school,v_founder
  from public.dreem_school_memberships m
  where m.role='platform_founder' and m.status='approved'
  limit 1;

  select m.id,m.profile_id into v_gate_membership,v_gate_user
  from public.dreem_school_memberships m
  where m.school_id=v_school and m.role='teacher' and m.status='approved'
  limit 1;

  if v_school is null or v_founder is null or v_gate_user is null then
    insert into public.dreem_acceptance_evidence(school_id,scenario,status,detail,source)
    values(v_school,'unauthorized_collector_blocked','blocked',jsonb_build_object('reason','Representative founder/gate actor unavailable'),'20261008000800_pickup_authorization_acceptance');
    return;
  end if;

  begin
    insert into public.students(school_id,matricule,full_name,class_name)
    values(v_school,'PICKUP-ACCEPT-'||substr(gen_random_uuid()::text,1,8),'Pickup Acceptance Learner','Acceptance')
    returning id into v_student;

    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_founder::text,'role','authenticated')::text,true);
    select credential_id,verification_token into v_credential,v_token
    from public.dreem_issue_student_credential(v_student,current_date+30,'pickup-acceptance-'||gen_random_uuid()::text);

    update public.dreem_school_memberships set role='security_guard' where id=v_gate_membership;
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_gate_user::text,'role','authenticated')::text,true);

    begin
      perform *
      from public.dreem_verify_and_record_learner_release(
        v_token,'not-an-authorized-collector','released','Acceptance attempt','{}'::jsonb,'pickup-acceptance-'||gen_random_uuid()::text
      );
    exception when others then
      if position('not currently authorized' in lower(sqlerrm))>0 then v_blocked:=true; else raise; end if;
    end;

    if not v_blocked then raise exception 'Unauthorized collector was not blocked'; end if;

    select count(*) into v_events
    from public.dreem_learner_release_events
    where student_id=v_student and decision='released';

    if v_events<>0 then raise exception 'Unauthorized release event was recorded'; end if;

    v_pass:=true;
    raise exception using errcode='P0001',message='DREEM_ACCEPTANCE_ROLLBACK';
  exception when sqlstate 'P0001' then
    if sqlerrm<>'DREEM_ACCEPTANCE_ROLLBACK' then raise; end if;
  end;

  if v_pass then
    insert into public.dreem_acceptance_evidence(school_id,scenario,status,detail,source)
    values(v_school,'unauthorized_collector_blocked','passed',
      jsonb_build_object('valid_learner_credential',true,'unauthorized_collector_blocked',true,'release_event_count',v_events,'fixture_rolled_back',true),
      '20261008000800_pickup_authorization_acceptance');
  end if;
end $$;