-- DREEM-SAFETY-001: authorized collector registry and evidence-led learner release.

alter table public.dreem_school_memberships drop constraint if exists dreem_school_memberships_role_check;
alter table public.dreem_school_memberships add constraint dreem_school_memberships_role_check check(role in ('platform_founder','school_owner','principal','administrator','academic_head','bursar','accountant','teacher','tutor','transport_manager','driver','security_guard','parent','student','auditor'));
alter table public.dreem_staff_invitations drop constraint if exists dreem_staff_invitations_role_check;
alter table public.dreem_staff_invitations add constraint dreem_staff_invitations_role_check check(role in ('school_owner','principal','administrator','academic_head','bursar','accountant','teacher','tutor','transport_manager','driver','security_guard','auditor'));

create table public.dreem_authorized_collectors(
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_id uuid references public.dreem_guardians(id) on delete set null,
  full_name text not null check(char_length(trim(full_name))>=3),
  relationship text not null,
  phone_last4 text check(phone_last4 is null or phone_last4 ~ '^[0-9]{4}$'),
  photo_url text,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  status text not null default 'active' check(status in ('active','revoked','expired')),
  evidence jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  revoked_by uuid references auth.users(id),
  revoked_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,idempotency_key)
);

create table public.dreem_learner_release_events(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  credential_id uuid references public.dreem_student_credentials(id) on delete set null,
  collector_id uuid references public.dreem_authorized_collectors(id) on delete set null,
  decision text not null check(decision in ('released','denied')),
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  recorded_by uuid not null references auth.users(id),
  idempotency_key text not null,
  recorded_at timestamptz not null default now(),
  unique(school_id,idempotency_key)
);

create index dreem_collectors_student_status_idx on public.dreem_authorized_collectors(school_id,student_id,status);
create index dreem_release_events_student_time_idx on public.dreem_learner_release_events(school_id,student_id,recorded_at desc);
alter table public.dreem_authorized_collectors enable row level security;
alter table public.dreem_learner_release_events enable row level security;

create policy dreem_collectors_read on public.dreem_authorized_collectors for select to authenticated using(
  (select private.dreem_has_role(school_id,array['leadership','administrator','transport_manager','security_guard','auditor']))
  or (select private.dreem_can_view_student(school_id,student_id))
);
create policy dreem_release_events_read on public.dreem_learner_release_events for select to authenticated using(
  (select private.dreem_has_role(school_id,array['leadership','administrator','transport_manager','security_guard','auditor']))
  or (select private.dreem_can_view_student(school_id,student_id))
);

revoke all on public.dreem_authorized_collectors,public.dreem_learner_release_events from anon,authenticated;
grant select on public.dreem_authorized_collectors,public.dreem_learner_release_events to authenticated;

create or replace function public.dreem_authorize_collector(
  p_student_id uuid,p_guardian_id uuid,p_full_name text,p_relationship text,p_phone_last4 text,
  p_photo_url text,p_valid_from timestamptz,p_valid_until timestamptz,p_evidence jsonb,p_idempotency_key text
) returns table(collector_id uuid,collector_status text,collector_token text)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_school uuid:=private.dreem_active_school_for_role(array['leadership','administrator']);v_id uuid;v_token text:=encode(public.gen_random_bytes(32),'hex');
begin
  if v_actor is null or v_school is null then raise exception 'School administration authorization is required.';end if;
  if not exists(select 1 from public.students s where s.id=p_student_id and s.school_id=v_school) then raise exception 'Learner does not belong to this school.';end if;
  if p_guardian_id is not null and not exists(select 1 from public.dreem_student_guardians sg where sg.school_id=v_school and sg.student_id=p_student_id and sg.guardian_id=p_guardian_id) then raise exception 'Guardian is not linked to this learner.';end if;
  if char_length(trim(coalesce(p_full_name,'')))<3 or nullif(trim(p_relationship),'') is null then raise exception 'Collector identity and relationship are required.';end if;
  if p_phone_last4 is not null and p_phone_last4 !~ '^[0-9]{4}$' then raise exception 'Only the final four phone digits may be stored for pickup confirmation.';end if;
  if p_valid_until is not null and p_valid_until<=coalesce(p_valid_from,now()) then raise exception 'Collector authorization expiry must follow its start.';end if;
  if nullif(trim(coalesce(p_evidence->>'note','')),'') is null then raise exception 'Authorization evidence is required.';end if;
  insert into public.dreem_authorized_collectors(token_hash,school_id,student_id,guardian_id,full_name,relationship,phone_last4,photo_url,valid_from,valid_until,evidence,created_by,idempotency_key)
  values(encode(public.digest(v_token,'sha256'),'hex'),v_school,p_student_id,p_guardian_id,trim(p_full_name),trim(p_relationship),p_phone_last4,nullif(trim(p_photo_url),''),coalesce(p_valid_from,now()),p_valid_until,p_evidence,v_actor,p_idempotency_key)
  on conflict(school_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key
  returning id,status into v_id,collector_status;
  perform private.dreem_write_event(v_school,'student',p_student_id,'safety.collector_authorized',concat('safety.collector:',p_idempotency_key),jsonb_build_object('collector_id',v_id,'valid_until',p_valid_until));
  collector_id:=v_id;collector_token:=v_token;return next;
end;$$;

create or replace function public.dreem_verify_and_record_learner_release(
  p_credential_token text,p_collector_token text,p_decision text,p_reason text,p_evidence jsonb,p_idempotency_key text
) returns table(event_id uuid,release_decision text,student_id uuid,student_display_name text,matricule text,collector_display_name text,collector_photo_url text)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_credential public.dreem_student_credentials%rowtype;v_collector public.dreem_authorized_collectors%rowtype;v_student public.students%rowtype;v_existing public.dreem_learner_release_events%rowtype;v_id uuid;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  select * into v_credential from public.dreem_student_credentials c where c.token_hash=encode(public.digest(p_credential_token,'sha256'),'hex');
  if not found then raise exception 'Learner credential was not recognized.';end if;
  if not private.dreem_has_role(v_credential.school_id,array['leadership','administrator','transport_manager','security_guard']) then raise exception 'Gate verification authorization is required.';end if;
  select * into v_student from public.students s where s.id=v_credential.student_id and s.school_id=v_credential.school_id;
  select * into v_collector from public.dreem_authorized_collectors c where c.token_hash=encode(public.digest(coalesce(p_collector_token,''),'sha256'),'hex') and c.school_id=v_credential.school_id and c.student_id=v_credential.student_id;
  select * into v_existing from public.dreem_learner_release_events e where e.school_id=v_credential.school_id and e.idempotency_key=p_idempotency_key;
  if found then event_id:=v_existing.id;release_decision:=v_existing.decision;student_id:=v_student.id;student_display_name:=v_student.full_name;matricule:=v_student.matricule;collector_display_name:=coalesce(v_collector.full_name,'Unrecognized collector');collector_photo_url:=v_collector.photo_url;return next;return;end if;
  if p_decision not in('released','denied') then raise exception 'Release decision is invalid.';end if;
  if nullif(trim(p_reason),'') is null then raise exception 'A release reason is required.';end if;
  if p_decision='released' and (v_credential.status<>'active' or v_credential.valid_until<current_date) then raise exception 'Learner credential is not active.';end if;
  if p_decision='released' and (v_collector.id is null or v_collector.status<>'active' or v_collector.valid_from>now() or (v_collector.valid_until is not null and v_collector.valid_until<now())) then raise exception 'Collector is not currently authorized for this learner.';end if;
  insert into public.dreem_learner_release_events(school_id,student_id,credential_id,collector_id,decision,reason,evidence,recorded_by,idempotency_key)
  values(v_credential.school_id,v_student.id,v_credential.id,v_collector.id,p_decision,trim(p_reason),coalesce(p_evidence,'{}'::jsonb),v_actor,p_idempotency_key) returning id into v_id;
  perform private.dreem_write_event(v_credential.school_id,'student',v_student.id,concat('safety.learner_',p_decision),concat('safety.release:',p_idempotency_key),jsonb_build_object('event_id',v_id,'collector_id',v_collector.id,'credential_id',v_credential.id));
  event_id:=v_id;release_decision:=p_decision;student_id:=v_student.id;student_display_name:=v_student.full_name;matricule:=v_student.matricule;collector_display_name:=coalesce(v_collector.full_name,'Unrecognized collector');collector_photo_url:=v_collector.photo_url;return next;
end;$$;

create or replace function public.dreem_invite_staff(p_email text,p_full_name text,p_role text,p_idempotency_key text)
returns table(invitation_id uuid,invitation_status text) language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_school uuid;v_id uuid;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  v_school:=private.dreem_active_school_for_role(array['leadership','support']);
  if v_school is null then raise exception 'You are not authorized to invite staff.';end if;
  if p_role not in('school_owner','principal','administrator','academic_head','bursar','accountant','teacher','tutor','transport_manager','driver','security_guard','auditor') then raise exception 'Unsupported staff role.';end if;
  if nullif(trim(p_email),'') is null or char_length(trim(coalesce(p_full_name,'')))<3 then raise exception 'Staff email and full name are required.';end if;
  insert into public.dreem_staff_invitations(school_id,email,full_name,role,invited_by,token_hash)
  values(v_school,lower(trim(p_email)),trim(p_full_name),p_role,v_actor,encode(public.digest(concat(p_idempotency_key,':',lower(trim(p_email))),'sha256'),'hex'))
  on conflict(school_id,email,role) do update set full_name=excluded.full_name,status='pending',updated_at=now()
  returning id,status into v_id,invitation_status;
  perform private.dreem_write_event(v_school,'staff_invitation',v_id,'staff.invited',concat('staff.invited:',p_idempotency_key),jsonb_build_object('email',lower(trim(p_email)),'role',p_role));
  invitation_id:=v_id;return next;
end;$$;

create trigger dreem_collectors_audit after insert or update or delete on public.dreem_authorized_collectors for each row execute function private.dreem_audit_row();
create trigger dreem_release_events_immutable before update or delete on public.dreem_learner_release_events for each row execute function private.dreem_prevent_mutation();
revoke all on function public.dreem_authorize_collector(uuid,uuid,text,text,text,text,timestamptz,timestamptz,jsonb,text),public.dreem_verify_and_record_learner_release(text,text,text,text,jsonb,text),public.dreem_invite_staff(text,text,text,text) from public,anon,authenticated;
grant execute on function public.dreem_authorize_collector(uuid,uuid,text,text,text,text,timestamptz,timestamptz,jsonb,text),public.dreem_verify_and_record_learner_release(text,text,text,text,jsonb,text),public.dreem_invite_staff(text,text,text,text) to authenticated;
