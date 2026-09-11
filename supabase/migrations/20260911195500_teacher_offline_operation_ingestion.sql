create table if not exists public.dreem_offline_operation_receipts (
  operation_id uuid primary key,
  school_id uuid not null,
  actor_id uuid not null,
  device_id text not null,
  command text not null,
  idempotency_key text not null,
  payload_digest text not null,
  captured_at timestamptz not null,
  received_at timestamptz not null default now(),
  status text not null check (status in ('accepted','rejected')),
  result jsonb,
  error_message text
);
create index if not exists dreem_offline_receipts_school_received_idx on public.dreem_offline_operation_receipts(school_id,received_at desc);
create index if not exists dreem_offline_receipts_actor_idx on public.dreem_offline_operation_receipts(actor_id,received_at desc);
alter table public.dreem_offline_operation_receipts enable row level security;
revoke all on table public.dreem_offline_operation_receipts from anon, authenticated;

create or replace function public.dreem_ingest_teacher_offline_operation(
  p_operation_id uuid,
  p_school_id uuid,
  p_device_id text,
  p_command text,
  p_payload jsonb,
  p_payload_digest text,
  p_captured_at timestamptz,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_existing public.dreem_offline_operation_receipts%rowtype;
  v_result jsonb;
  v_error text;
begin
  if v_actor is null then raise exception 'Authentication is required'; end if;
  if p_operation_id is null or p_school_id is null then raise exception 'Offline operation identity is incomplete'; end if;
  if not private.dreem_has_role(p_school_id,array['teacher','academic_head','leadership']) then raise exception 'This account is not authorized to replay teacher work for this school'; end if;
  if trim(coalesce(p_device_id,'')) = '' then raise exception 'Device identity is required'; end if;
  if p_command not in ('teacher.record_attendance','teacher.record_lesson_plan') then raise exception 'Unsupported offline teacher command'; end if;
  if trim(coalesce(p_idempotency_key,'')) = '' then raise exception 'Idempotency key is required'; end if;
  if p_payload->>'idempotencyKey' is distinct from p_idempotency_key then raise exception 'Payload idempotency key does not match the envelope'; end if;
  if p_payload_digest !~ '^[0-9a-f]{64}$' then raise exception 'Offline payload digest is invalid'; end if;
  if p_captured_at > now() + interval '10 minutes' then raise exception 'Offline capture time is in the future'; end if;
  if p_captured_at < now() - interval '30 days' then raise exception 'Offline operation is too old to replay automatically'; end if;

  select * into v_existing from public.dreem_offline_operation_receipts where operation_id=p_operation_id;
  if found then
    if v_existing.school_id<>p_school_id or v_existing.actor_id<>v_actor or v_existing.command<>p_command or v_existing.payload_digest<>p_payload_digest then raise exception 'Offline operation ID was already used with a different envelope'; end if;
    return jsonb_build_object('accepted',v_existing.status='accepted','duplicate',true,'result',v_existing.result,'error',v_existing.error_message);
  end if;

  begin
    if p_command='teacher.record_attendance' then
      select to_jsonb(x) into v_result from (select * from public.dreem_record_attendance(p_payload->>'className',(p_payload->>'sessionDate')::date,p_payload->>'periodLabel',p_payload->'marks',p_idempotency_key) limit 1) x;
    else
      select to_jsonb(x) into v_result from (select * from public.dreem_record_lesson_plan((p_payload->>'assignmentId')::uuid,(p_payload->>'lessonDate')::date,p_payload->>'title',p_payload->>'objectives',p_payload->>'learningActivity',p_payload->>'evidence',coalesce(p_payload->>'followUp',''),p_idempotency_key) limit 1) x;
    end if;
  exception when others then
    v_error := sqlerrm;
  end;

  if v_error is not null then
    insert into public.dreem_offline_operation_receipts(operation_id,school_id,actor_id,device_id,command,idempotency_key,payload_digest,captured_at,status,error_message)
    values(p_operation_id,p_school_id,v_actor,trim(p_device_id),p_command,p_idempotency_key,p_payload_digest,p_captured_at,'rejected',v_error);
    return jsonb_build_object('accepted',false,'duplicate',false,'error',v_error);
  end if;

  insert into public.dreem_offline_operation_receipts(operation_id,school_id,actor_id,device_id,command,idempotency_key,payload_digest,captured_at,status,result)
  values(p_operation_id,p_school_id,v_actor,trim(p_device_id),p_command,p_idempotency_key,p_payload_digest,p_captured_at,'accepted',v_result);
  return jsonb_build_object('accepted',true,'duplicate',false,'result',v_result);
end;
$$;
revoke all on function public.dreem_ingest_teacher_offline_operation(uuid,uuid,text,text,jsonb,text,timestamptz,text) from public;
grant execute on function public.dreem_ingest_teacher_offline_operation(uuid,uuid,text,text,jsonb,text,timestamptz,text) to authenticated;
