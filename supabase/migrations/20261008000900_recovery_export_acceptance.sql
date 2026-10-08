do $$
declare
  v_school uuid; v_founder uuid; v_bundle jsonb; v_verified jsonb; v_tampered jsonb;
begin
  select m.school_id,m.profile_id into v_school,v_founder
  from public.dreem_school_memberships m
  where m.role='platform_founder' and m.status='approved'
  limit 1;

  if v_school is null or v_founder is null then
    insert into public.dreem_acceptance_evidence(school_id,scenario,status,detail,source)
    values(v_school,'school_recovery_export_integrity','blocked',jsonb_build_object('reason','Founder context unavailable'),'20261008000900_recovery_export_acceptance');
    return;
  end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_founder::text,'role','authenticated')::text,true);
  v_bundle:=public.dreem_export_school_snapshot();
  v_verified:=public.dreem_verify_school_snapshot(v_bundle);

  if coalesce((v_verified->>'valid')::boolean,false)<>true then
    raise exception 'Generated recovery bundle failed verification';
  end if;

  v_tampered:=jsonb_set(v_bundle,'{payload,schema}','"tampered-recovery-format"'::jsonb,true);
  if coalesce((public.dreem_verify_school_snapshot(v_tampered)->>'valid')::boolean,false)=true then
    raise exception 'Tampered recovery bundle was accepted';
  end if;

  insert into public.dreem_acceptance_evidence(school_id,scenario,status,detail,source)
  values(v_school,'school_recovery_export_integrity','passed',
    jsonb_build_object(
      'export_generated',true,
      'digest_verified',true,
      'tamper_rejected',true,
      'students',coalesce((v_verified->>'students')::integer,0),
      'guardians',coalesce((v_verified->>'guardians')::integer,0),
      'payments',coalesce((v_verified->>'payments')::integer,0),
      'audit_events',coalesce((v_verified->>'audit_events')::integer,0),
      'destructive_restore_executed',false
    ),
    '20261008000900_recovery_export_acceptance');
end $$;