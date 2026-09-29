-- DREEM policy evaluation and controlled command layer.

create or replace function private.dreem_enqueue_policy_student(
  p_school_id uuid,
  p_student_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_school_id is null or p_student_id is null then return; end if;
  insert into public.dreem_policy_evaluation_queue(school_id,student_id,reason)
  values(p_school_id,p_student_id,coalesce(nullif(trim(p_reason),''),'school_record_changed'))
  on conflict(school_id,student_id) do update
    set reason=excluded.reason,updated_at=now();
end;
$$;
revoke all on function private.dreem_enqueue_policy_student(uuid,uuid,text) from public,anon,authenticated;

create or replace function private.dreem_seed_recommended_policy_rules(
  p_school_id uuid,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into public.dreem_policy_rules(
    school_id,code,name,domain,condition,action_level,owner_scope,recommended,created_by
  )
  values
    (
      p_school_id,'attendance_followup','Attendance follow-up','attendance',
      jsonb_build_object('metric','attendance_rate','operator','lt','threshold',80),
      'review','academics_delivery',true,p_actor
    ),
    (
      p_school_id,'missing_work_followup','Repeated missing school work','learning',
      jsonb_build_object('metric','missing_assignment_count','operator','gte','threshold',2),
      'review','academics_delivery',true,p_actor
    ),
    (
      p_school_id,'fee_overdue_followup','Overdue fee follow-up','finance',
      jsonb_build_object('metric','overdue_charge_count','operator','gte','threshold',1),
      'review','finance_collection',true,p_actor
    )
  on conflict(school_id,code) do nothing;

  insert into public.dreem_policy_evaluation_queue(school_id,student_id,reason)
  select p_school_id,s.id,'recommended_policy_seeded'
  from public.students s
  where s.school_id=p_school_id and s.merged_into_student_id is null
  on conflict(school_id,student_id) do update
    set reason='recommended_policy_seeded',updated_at=now();
end;
$$;
revoke all on function private.dreem_seed_recommended_policy_rules(uuid,uuid) from public,anon,authenticated;

create or replace function private.dreem_evaluate_student_policies(
  p_school_id uuid,
  p_student_id uuid
)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.dreem_policy_rules%rowtype;
  v_student public.students%rowtype;
  v_threshold numeric;
  v_count integer;
  v_met boolean;
  v_title text;
  v_explanation text;
  v_next text;
  v_severity text;
  v_evidence jsonb;
  v_open integer:=0;
begin
  select * into v_student
  from public.students
  where id=p_student_id
    and school_id=p_school_id
    and merged_into_student_id is null;

  if not found then return 0; end if;

  for r in
    select *
    from public.dreem_policy_rules
    where school_id=p_school_id
      and enabled
      and code in('attendance_followup','missing_work_followup','fee_overdue_followup')
    order by code
  loop
    v_threshold:=coalesce((r.condition->>'threshold')::numeric,0);
    v_met:=false;
    v_count:=0;
    v_evidence:='{}'::jsonb;

    if r.code='attendance_followup' then
      v_met:=v_student.attendance_rate is not null
        and v_student.attendance_rate<v_threshold;
      v_title:='Check '||v_student.full_name||'''s attendance';
      v_explanation:='Current attendance is '
        ||coalesce(round(v_student.attendance_rate,1)::text,'not available')
        ||'%, below the school attention level of '||v_threshold::text||'%.';
      v_next:='Review the attendance pattern and decide whether guardian follow-up or learner support is appropriate.';
      v_severity:=case
        when coalesce(v_student.attendance_rate,100)<60 then 'critical'
        else 'warning'
      end;
      v_evidence:=jsonb_build_object(
        'attendance_rate',v_student.attendance_rate,
        'threshold',v_threshold
      );

    elsif r.code='missing_work_followup' then
      select count(*) into v_count
      from public.dreem_assignments a
      join public.dreem_classes c
        on c.id=a.class_id and c.school_id=a.school_id
      where a.school_id=p_school_id
        and a.status='published'
        and a.due_at<now()
        and lower(c.name)=lower(coalesce(v_student.class_name,''))
        and not exists(
          select 1
          from public.dreem_assignment_submissions s
          where s.assignment_id=a.id and s.student_id=p_student_id
        );

      v_met:=v_count>=v_threshold;
      v_title:=v_student.full_name||' has repeated missing work';
      v_explanation:=v_count::text
        ||' released assignment(s) are past due without a recorded submission.';
      v_next:='Teacher reviews the missing work first; guardian follow-up or learner support comes after repeated patterns.';
      v_severity:=case
        when v_count>=greatest(v_threshold+2,4) then 'critical'
        else 'warning'
      end;
      v_evidence:=jsonb_build_object(
        'missing_assignment_count',v_count,
        'threshold',v_threshold
      );

    elsif r.code='fee_overdue_followup' then
      select count(*) into v_count
      from public.dreem_student_fee_charges c
      where c.school_id=p_school_id
        and c.student_id=p_student_id
        and c.due_on is not null
        and c.due_on<current_date
        and c.status not in('paid','waived','written_off');

      v_met:=v_count>=v_threshold;
      v_title:=v_student.full_name||' has an overdue fee item';
      v_explanation:=v_count::text||' fee charge(s) are past due and still open.';
      v_next:='Send the school''s normal reminder or place the account in the finance review queue; do not silently block the learner.';
      v_severity:='warning';
      v_evidence:=jsonb_build_object(
        'overdue_charge_count',v_count,
        'threshold',v_threshold
      );
    end if;

    if v_met then
      insert into public.dreem_policy_findings(
        school_id,rule_id,student_id,fingerprint,domain,severity,state,
        title,explanation,next_action,owner_scope,evidence
      )
      values(
        p_school_id,r.id,p_student_id,r.code||':'||p_student_id::text,
        r.domain,v_severity,'open',v_title,v_explanation,v_next,r.owner_scope,v_evidence
      )
      on conflict(school_id,fingerprint) do update
        set rule_id=excluded.rule_id,
            domain=excluded.domain,
            severity=excluded.severity,
            state='open',
            title=excluded.title,
            explanation=excluded.explanation,
            next_action=excluded.next_action,
            owner_scope=excluded.owner_scope,
            evidence=excluded.evidence,
            last_seen_at=now(),
            resolved_at=null;
      v_open:=v_open+1;
    else
      update public.dreem_policy_findings
      set state='resolved',resolved_at=now(),last_seen_at=now()
      where school_id=p_school_id
        and fingerprint=r.code||':'||p_student_id::text
        and state<>'resolved';
    end if;
  end loop;

  return v_open;
end;
$$;
revoke all on function private.dreem_evaluate_student_policies(uuid,uuid) from public,anon,authenticated;

create or replace function public.dreem_seed_recommended_policies(p_school_id uuid)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;

  if not public.dreem_has_authority(p_school_id,'school_configuration')
     and not public.dreem_has_authority(p_school_id,'institutional_leadership') then
    raise exception 'School configuration or institutional leadership authority is required.';
  end if;

  perform private.dreem_seed_recommended_policy_rules(p_school_id,auth.uid());

  select count(*) into v_count
  from public.dreem_policy_rules
  where school_id=p_school_id and recommended;

  insert into public.audit_events(school_id,actor_id,action,entity_type,detail)
  values(
    p_school_id,auth.uid(),'policy.recommended_seeded','policy_engine',
    jsonb_build_object('recommended_rules',v_count)
  );

  return v_count;
end;
$$;
revoke all on function public.dreem_seed_recommended_policies(uuid) from public,anon,authenticated;
grant execute on function public.dreem_seed_recommended_policies(uuid) to authenticated;

create or replace function public.dreem_upsert_policy_rule(
  p_school_id uuid,
  p_code text,
  p_name text,
  p_domain text,
  p_condition jsonb,
  p_action_level text,
  p_target_service text,
  p_owner_scope text,
  p_enabled boolean
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_threshold numeric;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;

  if not public.dreem_has_authority(p_school_id,'school_configuration') then
    raise exception 'School configuration authority is required.';
  end if;

  if p_code not in('attendance_followup','missing_work_followup','fee_overdue_followup') then
    raise exception 'Unsupported policy code.';
  end if;

  if p_domain not in('attendance','learning','finance','transport','admissions','care','communication') then
    raise exception 'Unsupported policy domain.';
  end if;

  if p_action_level not in('notify','remind','review','restrict_specific_service') then
    raise exception 'Unsupported policy action level.';
  end if;

  if p_owner_scope not in(
    'academics_approval','academics_delivery','admissions_decision','admissions_intake',
    'audit','communications_approve','communications_publish','finance_approval',
    'finance_collection','gate','institutional_leadership','safeguarding',
    'school_configuration','staff_management','transport_management','transport_operation'
  ) then
    raise exception 'Unsupported policy owner scope.';
  end if;

  if nullif(trim(p_name),'') is null then
    raise exception 'Policy name is required.';
  end if;

  v_threshold:=coalesce((p_condition->>'threshold')::numeric,-1);

  if p_code='attendance_followup' and (v_threshold<0 or v_threshold>100) then
    raise exception 'Attendance threshold must be between 0 and 100.';
  end if;

  if p_code in('missing_work_followup','fee_overdue_followup') and v_threshold<1 then
    raise exception 'Policy threshold must be at least 1.';
  end if;

  if p_action_level='restrict_specific_service' then
    if not public.dreem_has_authority(p_school_id,'institutional_leadership') then
      raise exception 'Institutional leadership authority is required before a rule can propose a service restriction.';
    end if;

    if p_target_service not in(
      'exam','report','trip','renewal','graduation','transport',
      'boarding','library','activity','document'
    ) then
      raise exception 'A supported target service is required.';
    end if;
  end if;

  insert into public.dreem_policy_rules(
    school_id,code,name,domain,condition,action_level,target_service,
    owner_scope,enabled,recommended,created_by
  )
  values(
    p_school_id,p_code,trim(p_name),p_domain,coalesce(p_condition,'{}'::jsonb),
    p_action_level,nullif(trim(coalesce(p_target_service,'')),''),
    p_owner_scope,coalesce(p_enabled,true),false,auth.uid()
  )
  on conflict(school_id,code) do update
    set name=excluded.name,
        domain=excluded.domain,
        condition=excluded.condition,
        action_level=excluded.action_level,
        target_service=excluded.target_service,
        owner_scope=excluded.owner_scope,
        enabled=excluded.enabled,
        recommended=false,
        updated_at=now()
  returning id into v_id;

  insert into public.dreem_policy_evaluation_queue(school_id,student_id,reason)
  select p_school_id,s.id,'policy_rule_changed'
  from public.students s
  where s.school_id=p_school_id and s.merged_into_student_id is null
  on conflict(school_id,student_id) do update
    set reason='policy_rule_changed',updated_at=now();

  if not coalesce(p_enabled,true) then
    update public.dreem_policy_findings
    set state='resolved',resolved_at=now(),last_seen_at=now()
    where rule_id=v_id and state<>'resolved';
  end if;

  insert into public.audit_events(school_id,actor_id,action,entity_type,entity_id,detail)
  values(
    p_school_id,auth.uid(),'policy.rule_configured','policy_rule',v_id,
    jsonb_build_object(
      'code',p_code,
      'action_level',p_action_level,
      'enabled',coalesce(p_enabled,true)
    )
  );

  return v_id;
end;
$$;
revoke all on function public.dreem_upsert_policy_rule(uuid,text,text,text,jsonb,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.dreem_upsert_policy_rule(uuid,text,text,text,jsonb,text,text,text,boolean) to authenticated;

create or replace function public.dreem_simulate_policy_rule(
  p_school_id uuid,
  p_code text,
  p_threshold numeric
)
returns table(affected_count integer,total_learners integer)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_affected integer:=0;
  v_total integer:=0;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;

  if not public.dreem_has_authority(p_school_id,'school_configuration')
     and not public.dreem_has_authority(p_school_id,'institutional_leadership') then
    raise exception 'School configuration or institutional leadership authority is required.';
  end if;

  if p_threshold is null or p_threshold<0 then
    raise exception 'A valid threshold is required.';
  end if;

  select count(*) into v_total
  from public.students s
  where s.school_id=p_school_id and s.merged_into_student_id is null;

  if p_code='attendance_followup' then
    if p_threshold>100 then raise exception 'Attendance threshold must be between 0 and 100.'; end if;

    select count(*) into v_affected
    from public.students s
    where s.school_id=p_school_id
      and s.merged_into_student_id is null
      and s.attendance_rate is not null
      and s.attendance_rate<p_threshold;

  elsif p_code='missing_work_followup' then
    select count(*) into v_affected
    from public.students s
    where s.school_id=p_school_id
      and s.merged_into_student_id is null
      and (
        select count(*)
        from public.dreem_assignments a
        join public.dreem_classes c
          on c.id=a.class_id and c.school_id=a.school_id
        where a.school_id=p_school_id
          and a.status='published'
          and a.due_at<now()
          and lower(c.name)=lower(coalesce(s.class_name,''))
          and not exists(
            select 1
            from public.dreem_assignment_submissions sub
            where sub.assignment_id=a.id and sub.student_id=s.id
          )
      )>=p_threshold;

  elsif p_code='fee_overdue_followup' then
    select count(*) into v_affected
    from public.students s
    where s.school_id=p_school_id
      and s.merged_into_student_id is null
      and (
        select count(*)
        from public.dreem_student_fee_charges c
        where c.school_id=p_school_id
          and c.student_id=s.id
          and c.due_on is not null
          and c.due_on<current_date
          and c.status not in('paid','waived','written_off')
      )>=p_threshold;
  else
    raise exception 'Unsupported policy code.';
  end if;

  affected_count:=v_affected;
  total_learners:=v_total;
  return next;
end;
$$;
revoke all on function public.dreem_simulate_policy_rule(uuid,text,numeric) from public,anon,authenticated;
grant execute on function public.dreem_simulate_policy_rule(uuid,text,numeric) to authenticated;

create or replace function public.dreem_run_policy_engine(
  p_school_id uuid,
  p_limit integer default 200
)
returns table(processed integer,open_findings integer,failed integer)
language plpgsql
security definer
set search_path=''
as $$
declare
  q record;
  v_processed integer:=0;
  v_open integer:=0;
  v_failed integer:=0;
  v_limit integer:=greatest(1,least(coalesce(p_limit,200),1000));
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;

  if not public.dreem_has_authority(p_school_id,'institutional_leadership')
     and not public.dreem_has_authority(p_school_id,'school_configuration') then
    raise exception 'Institutional leadership or school configuration authority is required.';
  end if;

  for q in
    select id,student_id
    from public.dreem_policy_evaluation_queue
    where school_id=p_school_id
    order by queued_at
    limit v_limit
  loop
    begin
      v_open:=v_open+private.dreem_evaluate_student_policies(p_school_id,q.student_id);
      delete from public.dreem_policy_evaluation_queue where id=q.id;
      v_processed:=v_processed+1;
    exception when others then
      update public.dreem_policy_evaluation_queue
      set attempts=attempts+1,last_error=left(sqlerrm,500),updated_at=now()
      where id=q.id;
      v_failed:=v_failed+1;
    end;
  end loop;

  insert into public.audit_events(school_id,actor_id,action,entity_type,detail)
  values(
    p_school_id,auth.uid(),'policy.engine_run','policy_engine',
    jsonb_build_object(
      'processed',v_processed,
      'open_findings',v_open,
      'failed',v_failed
    )
  );

  processed:=v_processed;
  open_findings:=v_open;
  failed:=v_failed;
  return next;
end;
$$;
revoke all on function public.dreem_run_policy_engine(uuid,integer) from public,anon,authenticated;
grant execute on function public.dreem_run_policy_engine(uuid,integer) to authenticated;

create or replace function public.dreem_run_policy_engine_system(
  p_limit integer default 500
)
returns table(processed integer,open_findings integer,failed integer)
language plpgsql
security definer
set search_path=''
as $$
declare
  q record;
  v_processed integer:=0;
  v_open integer:=0;
  v_failed integer:=0;
  v_limit integer:=greatest(1,least(coalesce(p_limit,500),2000));
begin
  for q in
    select id,school_id,student_id
    from public.dreem_policy_evaluation_queue
    order by queued_at
    limit v_limit
  loop
    begin
      v_open:=v_open+private.dreem_evaluate_student_policies(q.school_id,q.student_id);
      delete from public.dreem_policy_evaluation_queue where id=q.id;
      v_processed:=v_processed+1;
    exception when others then
      update public.dreem_policy_evaluation_queue
      set attempts=attempts+1,last_error=left(sqlerrm,500),updated_at=now()
      where id=q.id;
      v_failed:=v_failed+1;
    end;
  end loop;

  processed:=v_processed;
  open_findings:=v_open;
  failed:=v_failed;
  return next;
end;
$$;
revoke all on function public.dreem_run_policy_engine_system(integer) from public,anon,authenticated;
grant execute on function public.dreem_run_policy_engine_system(integer) to service_role;

create or replace function public.dreem_acknowledge_policy_finding(
  p_finding_id uuid,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  f public.dreem_policy_findings%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;

  select * into f
  from public.dreem_policy_findings
  where id=p_finding_id;

  if not found then return false; end if;

  if not public.dreem_has_authority(f.school_id,'institutional_leadership')
     and not public.dreem_has_authority(f.school_id,f.owner_scope) then
    raise exception 'You are not authorised to acknowledge this finding.';
  end if;

  update public.dreem_policy_findings
  set state='acknowledged',
      acknowledged_by=auth.uid(),
      acknowledged_at=now()
  where id=p_finding_id and state='open';

  insert into public.audit_events(school_id,actor_id,action,entity_type,entity_id,detail)
  values(
    f.school_id,auth.uid(),'policy.finding_acknowledged','policy_finding',f.id,
    jsonb_build_object('note',nullif(trim(coalesce(p_note,'')),''))
  );

  return true;
end;
$$;
revoke all on function public.dreem_acknowledge_policy_finding(uuid,text) from public,anon,authenticated;
grant execute on function public.dreem_acknowledge_policy_finding(uuid,text) to authenticated;

create or replace function public.dreem_set_service_eligibility(
  p_student_id uuid,
  p_service_code text,
  p_state text,
  p_reason text,
  p_finding_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_school uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;

  select school_id into v_school
  from public.students
  where id=p_student_id and merged_into_student_id is null;

  if v_school is null then raise exception 'Learner not found.'; end if;

  if not public.dreem_has_authority(v_school,'institutional_leadership')
     or not public.dreem_has_authority(v_school,'school_configuration') then
    raise exception 'Institutional leadership and school configuration authority are both required.';
  end if;

  if p_service_code not in(
    'exam','report','trip','renewal','graduation','transport',
    'boarding','library','activity','document'
  ) then
    raise exception 'Unsupported school service.';
  end if;

  if p_state not in('clear','warn','review','restricted') then
    raise exception 'Unsupported eligibility state.';
  end if;

  if p_state='restricted' and char_length(trim(coalesce(p_reason,'')))<5 then
    raise exception 'A clear reason is required before restricting a school service.';
  end if;

  if p_finding_id is not null and not exists(
    select 1
    from public.dreem_policy_findings f
    where f.id=p_finding_id
      and f.school_id=v_school
      and f.student_id=p_student_id
  ) then
    raise exception 'Policy finding does not belong to this learner.';
  end if;

  insert into public.dreem_service_eligibility(
    school_id,student_id,service_code,state,reason,finding_id,updated_by
  )
  values(
    v_school,p_student_id,p_service_code,p_state,
    nullif(trim(coalesce(p_reason,'')),''),
    p_finding_id,auth.uid()
  )
  on conflict(school_id,student_id,service_code) do update
    set state=excluded.state,
        reason=excluded.reason,
        finding_id=excluded.finding_id,
        updated_by=auth.uid(),
        updated_at=now()
  returning id into v_id;

  insert into public.dreem_domain_events(
    school_id,aggregate_type,aggregate_id,event_type,idempotency_key,payload
  )
  values(
    v_school,'student',p_student_id,'student.service_eligibility_changed',
    'service-eligibility:'||p_student_id::text||':'||p_service_code||':'||gen_random_uuid()::text,
    jsonb_build_object(
      'service_code',p_service_code,
      'state',p_state,
      'reason',nullif(trim(coalesce(p_reason,'')),''),
      'finding_id',p_finding_id
    )
  );

  insert into public.audit_events(school_id,actor_id,action,entity_type,entity_id,detail)
  values(
    v_school,auth.uid(),'student.service_eligibility_changed','student',p_student_id,
    jsonb_build_object(
      'service_code',p_service_code,
      'state',p_state,
      'reason',nullif(trim(coalesce(p_reason,'')),''),
      'finding_id',p_finding_id
    )
  );

  return v_id;
end;
$$;
revoke all on function public.dreem_set_service_eligibility(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.dreem_set_service_eligibility(uuid,text,text,text,uuid) to authenticated;
