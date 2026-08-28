-- Repair production workflow contracts exposed by end-to-end mobile testing.
-- pgcrypto is installed in the extensions schema in hosted Supabase.

create or replace function public.dreem_invite_staff(p_email text,p_full_name text,p_role text,p_idempotency_key text)
returns table(invitation_id uuid,invitation_status text)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_school uuid;v_id uuid;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  v_school:=private.dreem_active_school_for_role(array['leadership','support']);
  if v_school is null then raise exception 'You are not authorized to invite staff.';end if;
  if p_role not in('school_owner','principal','administrator','academic_head','bursar','accountant','teacher','tutor','transport_manager','driver','security_guard','auditor') then raise exception 'Unsupported staff role.';end if;
  if nullif(trim(p_email),'') is null or char_length(trim(coalesce(p_full_name,'')))<3 then raise exception 'Staff email and full name are required.';end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'An idempotency key is required.';end if;
  insert into public.dreem_staff_invitations(school_id,email,full_name,role,invited_by,token_hash)
  values(v_school,lower(trim(p_email)),trim(p_full_name),p_role,v_actor,encode(extensions.digest(concat(p_idempotency_key,':',lower(trim(p_email)))::text,'sha256'::text),'hex'))
  on conflict(school_id,email,role) do update set full_name=excluded.full_name,status='pending',updated_at=now()
  returning id,status into v_id,invitation_status;
  perform private.dreem_write_event(v_school,'staff_invitation',v_id,'staff.invited',concat('staff.invited:',p_idempotency_key),jsonb_build_object('email',lower(trim(p_email)),'role',p_role));
  invitation_id:=v_id;return next;
end;$$;

create or replace function public.dreem_record_attendance(p_class_name text,p_session_date date,p_period_label text,p_marks jsonb,p_idempotency_key text)
returns table(session_id uuid,recorded_count integer)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_school_id uuid;v_session_id uuid;v_count integer;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  v_school_id:=private.dreem_active_school_for_role(array['leadership','support','teacher']);
  if v_school_id is null then raise exception 'You are not authorized to record attendance.';end if;
  if nullif(trim(p_class_name),'') is null then raise exception 'A class is required.';end if;
  if p_session_date is null then raise exception 'Attendance date is required.';end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'An idempotency key is required.';end if;
  insert into public.dreem_attendance_sessions(school_id,class_name,session_date,period_label,captured_by,idempotency_key)
  values(v_school_id,trim(p_class_name),p_session_date,coalesce(nullif(trim(p_period_label),''),'AM'),v_actor,p_idempotency_key)
  on conflict(school_id,idempotency_key) do update set updated_at=now()
  returning id into v_session_id;
  insert into public.dreem_attendance_marks(school_id,session_id,student_id,status,note,recorded_by)
  select v_school_id,v_session_id,(mark->>'student_id')::uuid,mark->>'status',nullif(mark->>'note',''),v_actor
  from jsonb_array_elements(coalesce(p_marks,'[]'::jsonb)) as mark
  join public.students s on s.id=(mark->>'student_id')::uuid and s.school_id=v_school_id
  where mark->>'status' in('present','late','absent','excused')
  on conflict on constraint dreem_attendance_marks_session_id_student_id_key
  do update set status=excluded.status,note=excluded.note;
  select count(*) into v_count from public.dreem_attendance_marks am where am.session_id=v_session_id;
  perform private.dreem_write_event(v_school_id,'attendance_session',v_session_id,'attendance.submitted',concat('attendance.submitted:',p_idempotency_key),jsonb_build_object('class_name',p_class_name,'recorded_count',v_count));
  session_id:=v_session_id;recorded_count:=v_count;return next;
end;$$;

create or replace function public.dreem_enrol_learner(
  p_full_name text,p_class_name text,p_date_of_birth date,p_sex text,p_guardian_name text,
  p_guardian_phone text,p_guardian_email text,p_relationship text,p_opening_balance numeric,p_idempotency_key text
) returns table(student_id uuid,matricule text)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_school_id uuid;v_prefix text;v_student_id uuid;v_guardian_id uuid;v_matricule text;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  v_school_id:=private.dreem_active_school_for_role(array['leadership','support']);
  if v_school_id is null then raise exception 'You are not authorized to enrol learners.';end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'An idempotency key is required.';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(concat(v_school_id,':direct-enrolment:',p_idempotency_key),0));
  select e.aggregate_id,s.matricule into v_student_id,v_matricule
  from public.dreem_domain_events e join public.students s on s.id=e.aggregate_id and s.school_id=e.school_id
  where e.school_id=v_school_id and e.idempotency_key=concat('learner.enrolled:',p_idempotency_key) limit 1;
  if v_student_id is not null then student_id:=v_student_id;matricule:=v_matricule;return next;return;end if;
  if nullif(trim(p_full_name),'') is null then raise exception 'Learner name is required.';end if;
  if nullif(trim(p_class_name),'') is null then raise exception 'Learner class is required.';end if;
  if p_date_of_birth is null or p_date_of_birth>=current_date then raise exception 'A valid date of birth is required.';end if;
  if p_sex is not null and p_sex not in('female','male','other') then raise exception 'Unsupported sex value.';end if;
  if coalesce(p_opening_balance,0)<0 then raise exception 'Opening balance cannot be negative.';end if;
  select coalesce(b.student_id_prefix,'DRM') into v_prefix from public.dreem_school_brands b where b.school_id=v_school_id;
  v_matricule:=concat(coalesce(v_prefix,'DRM'),'-',to_char(now(),'YY'),'-',upper(substr(replace(gen_random_uuid()::text,'-',''),1,5)));
  insert into public.students(school_id,matricule,full_name,class_name,date_of_birth,sex,guardian_contact)
  values(v_school_id,v_matricule,trim(p_full_name),trim(p_class_name),p_date_of_birth,p_sex,nullif(trim(p_guardian_phone),''))
  returning id into v_student_id;
  if nullif(trim(p_guardian_name),'') is not null then
    insert into public.dreem_guardians(school_id,full_name,phone,email)
    values(v_school_id,trim(p_guardian_name),nullif(trim(p_guardian_phone),''),nullif(lower(trim(p_guardian_email)),'')) returning id into v_guardian_id;
    insert into public.dreem_student_guardians(school_id,student_id,guardian_id,relationship,is_primary)
    values(v_school_id,v_student_id,v_guardian_id,coalesce(nullif(trim(p_relationship),''),'guardian'),true);
  end if;
  insert into public.fee_accounts(school_id,student_id,amount_due,balance_due,status)
  values(v_school_id,v_student_id,coalesce(p_opening_balance,0),coalesce(p_opening_balance,0),'open');
  perform private.dreem_write_event(v_school_id,'student',v_student_id,'learner.enrolled',concat('learner.enrolled:',p_idempotency_key),jsonb_build_object('student_id',v_student_id,'matricule',v_matricule,'class_name',p_class_name));
  student_id:=v_student_id;matricule:=v_matricule;return next;
end;$$;

create or replace function public.dreem_issue_student_credential(p_student_id uuid,p_valid_until date,p_idempotency_key text)
returns table(credential_id uuid,verification_token text)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_school_id uuid;v_token text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  select s.school_id into v_school_id from public.students s where s.id=p_student_id;
  if v_school_id is null or not private.dreem_has_role(v_school_id,array['leadership','support']) then raise exception 'You are not authorized to issue this credential.';end if;
  if p_valid_until is null or p_valid_until<=current_date then raise exception 'Credential expiry must be in the future.';end if;
  update public.dreem_student_credentials c set status='revoked',revoked_at=now(),revoked_by=v_actor where c.school_id=v_school_id and c.student_id=p_student_id and c.status='active';
  insert into public.dreem_student_credentials(school_id,student_id,token_hash,valid_until,status,metadata)
  values(v_school_id,p_student_id,encode(extensions.digest(v_token::text,'sha256'::text),'hex'),p_valid_until,'active',jsonb_build_object('issued_by',v_actor)) returning id into credential_id;
  perform private.dreem_write_event(v_school_id,'student_credential',credential_id,'credential.issued',concat('credential.issued:',p_idempotency_key),jsonb_build_object('student_id',p_student_id,'valid_until',p_valid_until));
  verification_token:=v_token;return next;
end;$$;

create or replace function public.dreem_verify_student_credential(p_token text)
returns table(school_name text,school_short_name text,student_display_name text,matricule text,current_class text,valid_until date,credential_status text)
language plpgsql security definer set search_path='' as $$
begin return query select sc.name,b.short_name,s.full_name,s.matricule,coalesce(s.class_name,''),c.valid_until,
case when c.status='active' and c.valid_until>=current_date then 'valid' else c.status end
from public.dreem_student_credentials c join public.students s on s.id=c.student_id and s.school_id=c.school_id
join public.schools sc on sc.id=c.school_id left join public.dreem_school_brands b on b.school_id=c.school_id
where c.token_hash=encode(extensions.digest(p_token::text,'sha256'::text),'hex') limit 1;end;$$;

revoke all on function public.dreem_invite_staff(text,text,text,text),public.dreem_record_attendance(text,date,text,jsonb,text),public.dreem_enrol_learner(text,text,date,text,text,text,text,text,numeric,text),public.dreem_issue_student_credential(uuid,date,text),public.dreem_verify_student_credential(text) from public,anon;
grant execute on function public.dreem_invite_staff(text,text,text,text),public.dreem_record_attendance(text,date,text,jsonb,text),public.dreem_enrol_learner(text,text,date,text,text,text,text,text,numeric,text),public.dreem_issue_student_credential(uuid,date,text),public.dreem_verify_student_credential(text) to authenticated;
