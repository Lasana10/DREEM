-- DREEM persistent Institution Pulse snapshots and cross-domain change detection.

create table if not exists public.dreem_institution_pulse_snapshots(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  captured_at timestamptz not null default now(),
  source text not null default 'event' check(source in('event','manual','system')),
  attention_score integer not null default 0 check(attention_score>=0),
  metrics jsonb not null default '{}'::jsonb,
  evidence_counts jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id)
);

create index if not exists dreem_institution_pulse_school_time_idx
  on public.dreem_institution_pulse_snapshots(school_id,captured_at desc);

alter table public.dreem_institution_pulse_snapshots enable row level security;

revoke all on public.dreem_institution_pulse_snapshots from anon,authenticated;
grant select on public.dreem_institution_pulse_snapshots to authenticated;

drop policy if exists dreem_institution_pulse_read on public.dreem_institution_pulse_snapshots;
create policy dreem_institution_pulse_read
on public.dreem_institution_pulse_snapshots
for select to authenticated
using(
  public.dreem_has_authority(school_id,'institutional_leadership')
  or public.dreem_has_authority(school_id,'school_configuration')
  or public.dreem_has_authority(school_id,'audit')
);

create or replace function private.dreem_build_institution_pulse(p_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_learners integer:=0;
  v_attendance integer:=0;
  v_findings integer:=0;
  v_critical_findings integer:=0;
  v_admissions integer:=0;
  v_accepted integer:=0;
  v_pending_deposits integer:=0;
  v_pending_deposit_value numeric:=0;
  v_delayed_trips integer:=0;
  v_affected_riders integer:=0;
  v_urgent_cases integer:=0;
  v_urgent_signals integer:=0;
  v_failed_notifications integer:=0;
  v_payments_24h numeric:=0;
  v_score integer:=0;
begin
  select count(*) into v_learners
  from public.students s
  where s.school_id=p_school_id and s.merged_into_student_id is null;

  select count(*) into v_attendance
  from public.students s
  where s.school_id=p_school_id
    and s.merged_into_student_id is null
    and s.attendance_rate is not null
    and s.attendance_rate<80;

  select
    count(*) filter(where f.state<>'resolved'),
    count(*) filter(where f.state<>'resolved' and f.severity='critical')
  into v_findings,v_critical_findings
  from public.dreem_policy_findings f
  where f.school_id=p_school_id;

  select
    count(*) filter(where a.status not in('rejected','withdrawn','enrolled')),
    count(*) filter(where a.status='accepted' and a.enrolled_student_id is null)
  into v_admissions,v_accepted
  from public.dreem_admission_applications a
  where a.school_id=p_school_id;

  select count(*),coalesce(sum(b.amount),0)
  into v_pending_deposits,v_pending_deposit_value
  from public.dreem_cash_deposit_batches b
  where b.school_id=p_school_id and b.status='submitted';

  select count(*),coalesce(sum(t.assigned_students),0)
  into v_delayed_trips,v_affected_riders
  from public.dreem_transport_trips t
  where t.school_id=p_school_id
    and t.status='delayed'
    and t.service_date>=current_date-1;

  select count(*) into v_urgent_cases
  from public.dreem_student_cases c
  where c.school_id=p_school_id
    and c.status not in('resolved','closed')
    and c.priority in('urgent','critical');

  select count(*) into v_urgent_signals
  from public.dreem_community_signals s
  where s.school_id=p_school_id
    and s.status not in('resolved','closed')
    and s.severity in('urgent','safeguarding');

  select count(*) into v_failed_notifications
  from public.dreem_notification_deliveries d
  where d.school_id=p_school_id
    and d.status in('failed','retrying')
    and d.updated_at>=now()-interval '24 hours';

  select coalesce(sum(p.amount),0) into v_payments_24h
  from public.dreem_financial_payments p
  where p.school_id=p_school_id
    and p.received_at>=now()-interval '24 hours'
    and p.reverses_payment_id is null;

  v_score:=
    v_critical_findings*5
    +v_urgent_cases*5
    +v_urgent_signals*4
    +v_pending_deposits*3
    +v_delayed_trips*2
    +v_accepted*2
    +greatest(v_findings-v_critical_findings,0);

  return jsonb_build_object(
    'metrics',jsonb_build_object(
      'learners',v_learners,
      'attendance_attention',v_attendance,
      'open_policy_findings',v_findings,
      'critical_policy_findings',v_critical_findings,
      'admissions_in_progress',v_admissions,
      'accepted_waiting_enrolment',v_accepted,
      'cash_deposits_pending',v_pending_deposits,
      'cash_pending_confirmation',v_pending_deposit_value,
      'delayed_trips',v_delayed_trips,
      'learners_on_delayed_trips',v_affected_riders,
      'urgent_care_cases',v_urgent_cases,
      'urgent_school_messages',v_urgent_signals,
      'notification_failures_24h',v_failed_notifications,
      'payments_24h',v_payments_24h
    ),
    'evidence_counts',jsonb_build_object(
      'policy_findings',v_findings,
      'admissions',v_admissions,
      'pending_deposits',v_pending_deposits,
      'delayed_trips',v_delayed_trips,
      'urgent_cases',v_urgent_cases,
      'urgent_signals',v_urgent_signals,
      'notification_failures',v_failed_notifications
    ),
    'attention_score',v_score
  );
end;
$$;

revoke all on function private.dreem_build_institution_pulse(uuid)
from public,anon,authenticated;

create or replace function private.dreem_capture_institution_pulse(
  p_school_id uuid,
  p_source text,
  p_actor uuid,
  p_force boolean default false
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_payload jsonb;
  v_id uuid;
begin
  if p_source not in('event','manual','system') then
    raise exception 'Unsupported pulse source.';
  end if;

  if not exists(select 1 from public.schools where id=p_school_id) then
    raise exception 'School not found.';
  end if;

  if not p_force and exists(
    select 1 from public.dreem_institution_pulse_snapshots p
    where p.school_id=p_school_id
      and p.captured_at>=now()-interval '15 minutes'
  ) then
    select p.id into v_id
    from public.dreem_institution_pulse_snapshots p
    where p.school_id=p_school_id
    order by p.captured_at desc
    limit 1;
    return v_id;
  end if;

  v_payload:=private.dreem_build_institution_pulse(p_school_id);

  insert into public.dreem_institution_pulse_snapshots(
    school_id,source,attention_score,metrics,evidence_counts,created_by
  )
  values(
    p_school_id,p_source,
    coalesce((v_payload->>'attention_score')::integer,0),
    coalesce(v_payload->'metrics','{}'::jsonb),
    coalesce(v_payload->'evidence_counts','{}'::jsonb),
    p_actor
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function private.dreem_capture_institution_pulse(uuid,text,uuid,boolean)
from public,anon,authenticated;

create or replace function public.dreem_capture_institution_pulse(p_school_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;

  if not public.dreem_has_authority(p_school_id,'institutional_leadership')
     and not public.dreem_has_authority(p_school_id,'school_configuration') then
    raise exception 'Institutional leadership or school configuration authority is required.';
  end if;

  v_id:=private.dreem_capture_institution_pulse(
    p_school_id,'manual',auth.uid(),true
  );

  insert into public.audit_events(school_id,actor_id,action,entity_type,entity_id,detail)
  values(
    p_school_id,auth.uid(),'institution_pulse.captured',
    'institution_pulse',v_id,'{}'::jsonb
  );

  return v_id;
end;
$$;

revoke all on function public.dreem_capture_institution_pulse(uuid)
from public,anon,authenticated;
grant execute on function public.dreem_capture_institution_pulse(uuid) to authenticated;

create or replace function public.dreem_capture_all_institution_pulses()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  s record;
  v_count integer:=0;
begin
  for s in select id from public.schools loop
    perform private.dreem_capture_institution_pulse(s.id,'system',null,true);
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.dreem_capture_all_institution_pulses()
from public,anon,authenticated;
grant execute on function public.dreem_capture_all_institution_pulses() to service_role;

create or replace function public.dreem_get_institution_pulse(p_school_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_current public.dreem_institution_pulse_snapshots%rowtype;
  v_previous public.dreem_institution_pulse_snapshots%rowtype;
  v_live jsonb;
  v_changes jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;

  if not public.dreem_has_authority(p_school_id,'institutional_leadership')
     and not public.dreem_has_authority(p_school_id,'school_configuration')
     and not public.dreem_has_authority(p_school_id,'audit') then
    raise exception 'Institution Pulse access is not authorised.';
  end if;

  v_live:=private.dreem_build_institution_pulse(p_school_id);

  select * into v_current
  from public.dreem_institution_pulse_snapshots p
  where p.school_id=p_school_id
  order by p.captured_at desc
  limit 1;

  select * into v_previous
  from public.dreem_institution_pulse_snapshots p
  where p.school_id=p_school_id
    and (
      v_current.id is null
      or p.captured_at<=v_current.captured_at-interval '20 hours'
    )
  order by p.captured_at desc
  limit 1;

  v_changes:=jsonb_build_object(
    'attention_score',
      coalesce((v_live->>'attention_score')::integer,0)
      -coalesce(v_previous.attention_score,coalesce((v_live->>'attention_score')::integer,0)),
    'open_policy_findings',
      coalesce((v_live->'metrics'->>'open_policy_findings')::integer,0)
      -coalesce((v_previous.metrics->>'open_policy_findings')::integer,coalesce((v_live->'metrics'->>'open_policy_findings')::integer,0)),
    'attendance_attention',
      coalesce((v_live->'metrics'->>'attendance_attention')::integer,0)
      -coalesce((v_previous.metrics->>'attendance_attention')::integer,coalesce((v_live->'metrics'->>'attendance_attention')::integer,0)),
    'cash_pending_confirmation',
      coalesce((v_live->'metrics'->>'cash_pending_confirmation')::numeric,0)
      -coalesce((v_previous.metrics->>'cash_pending_confirmation')::numeric,coalesce((v_live->'metrics'->>'cash_pending_confirmation')::numeric,0)),
    'delayed_trips',
      coalesce((v_live->'metrics'->>'delayed_trips')::integer,0)
      -coalesce((v_previous.metrics->>'delayed_trips')::integer,coalesce((v_live->'metrics'->>'delayed_trips')::integer,0)),
    'accepted_waiting_enrolment',
      coalesce((v_live->'metrics'->>'accepted_waiting_enrolment')::integer,0)
      -coalesce((v_previous.metrics->>'accepted_waiting_enrolment')::integer,coalesce((v_live->'metrics'->>'accepted_waiting_enrolment')::integer,0))
  );

  return jsonb_build_object(
    'school_id',p_school_id,
    'generated_at',now(),
    'current',v_live,
    'latest_snapshot',case when v_current.id is null then null else jsonb_build_object(
      'id',v_current.id,
      'captured_at',v_current.captured_at,
      'source',v_current.source,
      'attention_score',v_current.attention_score,
      'metrics',v_current.metrics,
      'evidence_counts',v_current.evidence_counts
    ) end,
    'comparison_snapshot',case when v_previous.id is null then null else jsonb_build_object(
      'id',v_previous.id,
      'captured_at',v_previous.captured_at,
      'source',v_previous.source,
      'attention_score',v_previous.attention_score,
      'metrics',v_previous.metrics
    ) end,
    'changes',v_changes
  );
end;
$$;

revoke all on function public.dreem_get_institution_pulse(uuid)
from public,anon,authenticated;
grant execute on function public.dreem_get_institution_pulse(uuid) to authenticated;

create or replace function private.dreem_maybe_capture_pulse_from_event()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform private.dreem_capture_institution_pulse(
    new.school_id,'event',null,false
  );
  return new;
end;
$$;

revoke all on function private.dreem_maybe_capture_pulse_from_event()
from public,anon,authenticated;

drop trigger if exists dreem_pulse_from_domain_event on public.dreem_domain_events;
create trigger dreem_pulse_from_domain_event
after insert on public.dreem_domain_events
for each row execute function private.dreem_maybe_capture_pulse_from_event();

drop trigger if exists dreem_pulse_from_policy_finding on public.dreem_policy_findings;
create trigger dreem_pulse_from_policy_finding
after insert or update of state,severity,last_seen_at on public.dreem_policy_findings
for each row execute function private.dreem_maybe_capture_pulse_from_event();

do $$
declare
  s record;
begin
  for s in select id from public.schools loop
    perform private.dreem_capture_institution_pulse(s.id,'system',null,true);
  end loop;
end;
$$;
