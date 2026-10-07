create or replace function public.dreem_export_school_snapshot()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_school uuid;
  v_payload jsonb;
  v_digest text;
begin
  if v_user is null then raise exception 'Authentication is required'; end if;
  select a.school_id into v_school from public.dreem_user_active_school a where a.user_id=v_user;
  if v_school is null then raise exception 'Choose an active school before exporting'; end if;
  if not (
    public.dreem_has_authority(v_school,'school_configuration')
    or public.dreem_has_authority(v_school,'institutional_leadership')
    or public.dreem_has_authority(v_school,'audit')
  ) then raise exception 'School export authority is required'; end if;

  v_payload := jsonb_build_object(
    'schema','dreem-school-recovery-v1',
    'school_id',v_school,
    'exported_at',now(),
    'school',(select to_jsonb(s) from public.schools s where s.id=v_school),
    'brand',(select to_jsonb(b) from public.dreem_school_brands b where b.school_id=v_school),
    'academic_years',(select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_on),'[]'::jsonb) from public.dreem_academic_years x where x.school_id=v_school),
    'terms',(select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_on),'[]'::jsonb) from public.dreem_terms x where x.school_id=v_school),
    'classes',(select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]'::jsonb) from public.dreem_classes x where x.school_id=v_school),
    'subjects',(select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]'::jsonb) from public.dreem_subjects x where x.school_id=v_school),
    'students',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]'::jsonb) from public.students x where x.school_id=v_school),
    'guardians',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]'::jsonb) from public.dreem_guardians x where x.school_id=v_school),
    'student_guardians',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.dreem_student_guardians x where x.school_id=v_school),
    'placements',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]'::jsonb) from public.dreem_learner_placements x where x.school_id=v_school),
    'teaching_assignments',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]'::jsonb) from public.dreem_teaching_assignments x where x.school_id=v_school),
    'timetable',(select coalesce(jsonb_agg(to_jsonb(x) order by x.day_of_week,x.start_time),'[]'::jsonb) from public.dreem_timetable_entries x where x.school_id=v_school),
    'academic_documents',(select coalesce(jsonb_agg(to_jsonb(x) - 'storage_path' order by x.created_at),'[]'::jsonb) from public.dreem_academic_documents x where x.school_id=v_school),
    'curriculum_outcomes',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]'::jsonb) from public.dreem_curriculum_outcomes x where x.school_id=v_school),
    'lesson_plans',(select coalesce(jsonb_agg(to_jsonb(x) order by x.lesson_date),'[]'::jsonb) from public.dreem_lesson_plans x where x.school_id=v_school),
    'lesson_plan_outcomes',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.dreem_lesson_plan_outcomes x join public.dreem_lesson_plans lp on lp.id=x.lesson_plan_id where lp.school_id=v_school),
    'attendance_sessions',(select coalesce(jsonb_agg(to_jsonb(x) order by x.session_date),'[]'::jsonb) from public.dreem_attendance_sessions x where x.school_id=v_school),
    'attendance_marks',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.dreem_attendance_marks x where x.school_id=v_school),
    'assessments',(select coalesce(jsonb_agg(to_jsonb(x) order by x.assessment_date),'[]'::jsonb) from public.dreem_assessments x where x.school_id=v_school),
    'marks',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.dreem_marks x where x.school_id=v_school),
    'student_cases',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]'::jsonb) from public.dreem_student_cases x where x.school_id=v_school),
    'case_events',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]'::jsonb) from public.dreem_case_events x where x.school_id=v_school),
    'interventions',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]'::jsonb) from public.dreem_interventions x where x.school_id=v_school),
    'announcements',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]'::jsonb) from public.dreem_announcements x where x.school_id=v_school),
    'notification_deliveries',(select coalesce(jsonb_agg(to_jsonb(x) order by x.queued_at),'[]'::jsonb) from public.dreem_notification_deliveries x where x.school_id=v_school),
    'fee_accounts',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.fee_accounts x where x.school_id=v_school),
    'fee_plans',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.dreem_fee_plans x where x.school_id=v_school),
    'fee_plan_items',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.dreem_fee_plan_items x where x.school_id=v_school),
    'student_fee_charges',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.dreem_student_fee_charges x where x.school_id=v_school),
    'fee_adjustments',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.dreem_fee_adjustments x where x.school_id=v_school),
    'payments',(select coalesce(jsonb_agg(to_jsonb(x) order by x.received_at),'[]'::jsonb) from public.dreem_financial_payments x where x.school_id=v_school),
    'payment_allocations',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.dreem_payment_allocations x where x.school_id=v_school),
    'cashier_sessions',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.dreem_cashier_sessions x where x.school_id=v_school),
    'reconciliation_reviews',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.dreem_reconciliation_reviews x where x.school_id=v_school),
    'deposit_batches',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.dreem_cash_deposit_batches x where x.school_id=v_school),
    'deposit_items',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.dreem_cash_deposit_items x where x.school_id=v_school),
    'credentials',(select coalesce(jsonb_agg(to_jsonb(x) - 'credential_token' order by x.created_at),'[]'::jsonb) from public.dreem_student_credentials x where x.school_id=v_school),
    'authorized_collectors',(select coalesce(jsonb_agg(to_jsonb(x) - 'token_hash' order by x.created_at),'[]'::jsonb) from public.dreem_authorized_collectors x where x.school_id=v_school),
    'release_events',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]'::jsonb) from public.dreem_learner_release_events x where x.school_id=v_school),
    'transport_routes',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.dreem_transport_routes x where x.school_id=v_school),
    'transport_stops',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.dreem_transport_stops x where x.school_id=v_school),
    'transport_assignments',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.dreem_transport_assignments x where x.school_id=v_school),
    'transport_trips',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.dreem_transport_trips x where x.school_id=v_school),
    'transport_trip_events',(select coalesce(jsonb_agg(to_jsonb(x) order by x.recorded_at),'[]'::jsonb) from public.dreem_transport_trip_events x where x.school_id=v_school),
    'audit_events',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]'::jsonb) from public.audit_events x where x.school_id=v_school)
  );

  v_digest := encode(public.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
  return jsonb_build_object(
    'manifest',jsonb_build_object('format','dreem-school-recovery-v1','school_id',v_school,'generated_at',now(),'sha256',v_digest),
    'payload',v_payload
  );
end;
$$;

create or replace function public.dreem_verify_school_snapshot(p_export jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_payload jsonb := p_export->'payload';
  v_manifest jsonb := p_export->'manifest';
  v_digest text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication is required'; end if;
  if coalesce(v_manifest->>'format','')<>'dreem-school-recovery-v1' or coalesce(v_payload->>'schema','')<>'dreem-school-recovery-v1' then
    return jsonb_build_object('valid',false,'reason','Unsupported recovery bundle format');
  end if;
  v_digest := encode(public.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
  return jsonb_build_object(
    'valid',v_digest=coalesce(v_manifest->>'sha256',''),
    'school_id',v_payload->>'school_id',
    'sha256',v_digest,
    'students',jsonb_array_length(coalesce(v_payload->'students','[]'::jsonb)),
    'guardians',jsonb_array_length(coalesce(v_payload->'guardians','[]'::jsonb)),
    'payments',jsonb_array_length(coalesce(v_payload->'payments','[]'::jsonb)),
    'audit_events',jsonb_array_length(coalesce(v_payload->'audit_events','[]'::jsonb))
  );
end;
$$;

revoke all on function public.dreem_export_school_snapshot() from public, anon;
revoke all on function public.dreem_verify_school_snapshot(jsonb) from public, anon;
grant execute on function public.dreem_export_school_snapshot() to authenticated, service_role;
grant execute on function public.dreem_verify_school_snapshot(jsonb) to authenticated, service_role;