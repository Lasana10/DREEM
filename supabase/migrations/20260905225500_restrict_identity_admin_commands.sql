create or replace function public.dreem_enrol_learner(p_full_name text, p_class_name text, p_date_of_birth date, p_sex text, p_guardian_name text, p_guardian_phone text, p_guardian_email text, p_relationship text, p_opening_balance numeric, p_idempotency_key text)
returns table(student_id uuid, matricule text)
language plpgsql
security definer
set search_path to ''
as $function$
declare v_actor uuid:=(select auth.uid());v_school_id uuid;v_prefix text;v_student_id uuid;v_guardian_id uuid;v_matricule text;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  v_school_id:=private.dreem_active_school_for_role(array['platform_founder','school_owner','principal','administrator']);
  if v_school_id is null then raise exception 'You are not authorized to enrol learners.';end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'An idempotency key is required.';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(concat(v_school_id,':direct-enrolment:',p_idempotency_key),0));
  select e.aggregate_id,s.matricule into v_student_id,v_matricule from public.dreem_domain_events e join public.students s on s.id=e.aggregate_id and s.school_id=e.school_id where e.school_id=v_school_id and e.idempotency_key=concat('learner.enrolled:',p_idempotency_key) limit 1;
  if v_student_id is not null then student_id:=v_student_id;matricule:=v_matricule;return next;return;end if;
  if nullif(trim(p_full_name),'') is null then raise exception 'Learner name is required.';end if;
  if nullif(trim(p_class_name),'') is null then raise exception 'Learner class is required.';end if;
  if p_date_of_birth is null or p_date_of_birth>=current_date then raise exception 'A valid date of birth is required.';end if;
  if p_sex is not null and p_sex not in('female','male','other') then raise exception 'Unsupported sex value.';end if;
  if coalesce(p_opening_balance,0)<0 then raise exception 'Opening balance cannot be negative.';end if;
  select coalesce(b.student_id_prefix,'DRM') into v_prefix from public.dreem_school_brands b where b.school_id=v_school_id;
  v_matricule:=concat(coalesce(v_prefix,'DRM'),'-',to_char(now(),'YY'),'-',upper(substr(replace(gen_random_uuid()::text,'-',''),1,5)));
  insert into public.students(school_id,matricule,full_name,class_name,date_of_birth,sex,guardian_contact) values(v_school_id,v_matricule,trim(p_full_name),trim(p_class_name),p_date_of_birth,p_sex,nullif(trim(p_guardian_phone),'')) returning id into v_student_id;
  if nullif(trim(p_guardian_name),'') is not null then
    insert into public.dreem_guardians(school_id,full_name,phone,email) values(v_school_id,trim(p_guardian_name),nullif(trim(p_guardian_phone),''),nullif(lower(trim(p_guardian_email)),'')) returning id into v_guardian_id;
    insert into public.dreem_student_guardians(school_id,student_id,guardian_id,relationship,is_primary) values(v_school_id,v_student_id,v_guardian_id,coalesce(nullif(trim(p_relationship),''),'guardian'),true);
  end if;
  insert into public.fee_accounts(school_id,student_id,amount_due,balance_due,status) values(v_school_id,v_student_id,coalesce(p_opening_balance,0),coalesce(p_opening_balance,0),'open');
  perform private.dreem_write_event(v_school_id,'student',v_student_id,'learner.enrolled',concat('learner.enrolled:',p_idempotency_key),jsonb_build_object('student_id',v_student_id,'matricule',v_matricule,'class_name',p_class_name));
  student_id:=v_student_id;matricule:=v_matricule;return next;
end;$function$;

create or replace function public.dreem_issue_student_credential(p_student_id uuid, p_valid_until date, p_idempotency_key text)
returns table(credential_id uuid, verification_token text)
language plpgsql
security definer
set search_path to ''
as $function$
declare v_actor uuid:=(select auth.uid());v_school_id uuid;v_matricule text;v_prefix text;v_version integer;v_card_number text;v_token text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  select s.school_id,s.matricule into v_school_id,v_matricule from public.students s where s.id=p_student_id for update;
  if v_school_id is null or not private.dreem_has_role(v_school_id,array['platform_founder','school_owner','principal','administrator']) then raise exception 'You are not authorized to issue this credential.';end if;
  if p_valid_until is null or p_valid_until<=current_date then raise exception 'Credential expiry must be in the future.';end if;
  if nullif(trim(coalesce(p_idempotency_key,'')),'') is null then raise exception 'An idempotency key is required.';end if;
  select coalesce(nullif(trim(b.student_id_prefix),''),'DRM') into v_prefix from public.dreem_school_brands b where b.school_id=v_school_id;
  v_prefix:=coalesce(v_prefix,'DRM');
  select coalesce(max(c.card_version),0)+1 into v_version from public.dreem_student_credentials c where c.school_id=v_school_id and c.student_id=p_student_id;
  v_card_number:=upper(regexp_replace(v_prefix||'-'||coalesce(v_matricule,p_student_id::text)||'-V'||v_version::text,'[^A-Za-z0-9-]+','','g'));
  update public.dreem_student_credentials c set status='revoked',revoked_at=now(),revoked_by=v_actor where c.school_id=v_school_id and c.student_id=p_student_id and c.status='active';
  insert into public.dreem_student_credentials(school_id,student_id,token_hash,valid_until,status,metadata,card_number,card_version) values(v_school_id,p_student_id,encode(extensions.digest(v_token::text,'sha256'::text),'hex'),p_valid_until,'active',jsonb_build_object('issued_by',v_actor,'card_number',v_card_number,'card_version',v_version),v_card_number,v_version) returning id into credential_id;
  perform private.dreem_write_event(v_school_id,'student_credential',credential_id,'credential.issued',concat('credential.issued:',p_idempotency_key),jsonb_build_object('student_id',p_student_id,'valid_until',p_valid_until,'card_number',v_card_number,'card_version',v_version));
  verification_token:=v_token;return next;
end;$function$;

revoke all on function public.dreem_enrol_learner(text,text,date,text,text,text,text,text,numeric,text) from public, anon;
revoke all on function public.dreem_issue_student_credential(uuid,date,text) from public, anon;
grant execute on function public.dreem_enrol_learner(text,text,date,text,text,text,text,text,numeric,text) to authenticated, service_role;
grant execute on function public.dreem_issue_student_credential(uuid,date,text) to authenticated, service_role;