-- DREEM: first safe, irreversible learner-identity cutover step.
-- Additive only. Does not touch any existing pupil rows, enrolment links, fees or guardians.
create table if not exists public.dreem_pupil_import_batches (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  idempotency_key text not null,
  request_hash text not null,
  row_count integer not null check (row_count between 1 and 200),
  inserted_ids uuid[] not null default '{}',
  imported_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (school_id, idempotency_key)
);
create index if not exists dreem_pupil_import_batches_school_time_idx on public.dreem_pupil_import_batches(school_id,created_at desc);
alter table public.dreem_pupil_import_batches enable row level security;
revoke all on public.dreem_pupil_import_batches from anon;
revoke all on public.dreem_pupil_import_batches from authenticated;
grant select on public.dreem_pupil_import_batches to authenticated;
drop policy if exists dreem_pupil_import_batches_administrators on public.dreem_pupil_import_batches;
create policy dreem_pupil_import_batches_administrators on public.dreem_pupil_import_batches
 for select to authenticated using (private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator']));

create or replace function public.dreem_import_verified_pupils(
 p_rows jsonb,p_idempotency_key text,p_confirmation text
) returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
 v_actor uuid := (select auth.uid());
 v_school uuid;
 v_year uuid;
 v_existing public.dreem_pupil_import_batches%rowtype;
 v_hash text;
 v_row jsonb;
 v_row_count integer;
 v_id text;
 v_name text;
 v_class text;
 v_resolved_class text;
 v_class_count integer;
 v_existing_id uuid;
 v_seen_ids text[] := '{}'::text[];
 v_seen_names text[] := '{}'::text[];
 v_inserted_ids uuid[] := '{}'::uuid[];
 v_new_id uuid;
 v_ordinal integer := 0;
 v_batch_id uuid;
begin
 if v_actor is null then raise exception 'Sign in as an authorised school administrator.'; end if;
 v_school := private.dreem_active_school_context();
 if v_school is null or not private.dreem_has_role(v_school,array['platform_founder','school_owner','principal','administrator']) then
  raise exception 'Only approved school administrators may import pupil identities.';
 end if;
 if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'A reviewed array of pupils is required.'; end if;
 v_row_count := jsonb_array_length(p_rows);
 if v_row_count < 1 or v_row_count > 200 then raise exception 'Import requires 1 to 200 reviewed pupils.'; end if;
 if length(trim(coalesce(p_idempotency_key,''))) < 12 or length(p_idempotency_key)>160 then
  raise exception 'A stable unique import-batch key is required.';
 end if;
 if p_confirmation is distinct from 'IMPORT '||v_row_count::text||' NEW PUPILS' then
  raise exception 'Explicit import confirmation does not match the pupil count.';
 end if;
 -- Protect concurrent imports to the same school before checking matricules.
 perform pg_advisory_xact_lock(hashtext('dreem_pupil_import'),hashtext(v_school::text));
 v_hash := md5(p_rows::text);
 select * into v_existing from public.dreem_pupil_import_batches
 where school_id=v_school and idempotency_key=p_idempotency_key;
 if found then
  if v_existing.request_hash <> v_hash or v_existing.row_count <> v_row_count then
   raise exception 'Import batch key was reused for different records. No pupils were changed.';
  end if;
  return jsonb_build_object('batchId',v_existing.id,'imported',v_existing.row_count,'alreadyApplied',true);
 end if;
 select count(*),min(id) into v_class_count,v_year from public.dreem_academic_years
 where school_id=v_school and status='active';
 if v_class_count<>1 then raise exception 'One active school year is required before learner import.'; end if;
 for v_row in select value from jsonb_array_elements(p_rows) loop
  v_ordinal:=v_ordinal+1;
  if jsonb_typeof(v_row)<>'object' then raise exception 'Pupil row % is not an object.',v_ordinal;end if;
  v_id := upper(btrim(coalesce(v_row->>'matricule','')));
  v_name := btrim(coalesce(v_row->>'fullName',''));
  v_class := btrim(coalesce(v_row->>'className',''));
  if length(v_id)<2 or length(v_id)>64 or length(v_name)<3 or length(v_name)>200 or length(v_class)<1 or length(v_class)>120 then
   raise exception 'Pupil row % is incomplete or outside accepted length limits.',v_ordinal;
  end if;
  if v_id=any(v_seen_ids) or lower(v_name)=any(v_seen_names) then
   raise exception 'Repeated pupil identifier or name within the import batch, row %.',v_ordinal;
  end if;
  v_seen_ids:=array_append(v_seen_ids,v_id);
  v_seen_names:=array_append(v_seen_names,lower(v_name));
  select count(*),min(name) into v_class_count,v_resolved_class from public.dreem_classes
   where school_id=v_school and academic_year_id=v_year and lower(btrim(name))=lower(v_class);
  if v_class_count<>1 then raise exception 'Pupil row % does not match one class in the active school year.',v_ordinal;end if;
  select s.id into v_existing_id from public.students s
   where s.school_id=v_school and (upper(btrim(s.matricule))=v_id or lower(btrim(s.full_name))=lower(v_name))
   limit 1;
  if v_existing_id is not null then raise exception 'An existing school identity conflicts with pupil row %. No records were changed.',v_ordinal;end if;
  insert into public.students(school_id,matricule,full_name,class_name)
   values(v_school,v_id,v_name,v_resolved_class) returning id into v_new_id;
  v_inserted_ids:=array_append(v_inserted_ids,v_new_id);
  v_existing_id:=null;
 end loop;
 insert into public.dreem_pupil_import_batches(school_id,idempotency_key,request_hash,row_count,inserted_ids,imported_by)
 values(v_school,p_idempotency_key,v_hash,v_row_count,v_inserted_ids,v_actor) returning id into v_batch_id;
 perform private.dreem_write_event(v_school,'pupil_import',v_batch_id,'pupil.import.completed',
    'pupil-import:'||p_idempotency_key,jsonb_build_object('count',v_row_count,'batch_id',v_batch_id));
 return jsonb_build_object('batchId',v_batch_id,'imported',v_row_count,'alreadyApplied',false);
exception when unique_violation then
 raise exception 'A pupil identifier already exists. No part of this batch was imported.';
end
$function$;
revoke all on function public.dreem_import_verified_pupils(jsonb,text,text) from public,anon;
grant execute on function public.dreem_import_verified_pupils(jsonb,text,text) to authenticated;
