create or replace function public.dreem_issue_student_credential(p_student_id uuid, p_valid_until date, p_idempotency_key text)
returns table(credential_id uuid, verification_token text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_school_id uuid;
  v_matricule text;
  v_prefix text;
  v_version integer;
  v_card_number text;
  v_token text := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
begin
  if v_actor is null then raise exception 'Authentication is required.'; end if;

  select s.school_id, s.matricule
    into v_school_id, v_matricule
    from public.students s
   where s.id = p_student_id
   for update;

  if v_school_id is null or not private.dreem_has_role(v_school_id,array['leadership','support']) then
    raise exception 'You are not authorized to issue this credential.';
  end if;
  if p_valid_until is null or p_valid_until <= current_date then
    raise exception 'Credential expiry must be in the future.';
  end if;

  select coalesce(nullif(trim(b.student_id_prefix),''),'DRM')
    into v_prefix
    from public.dreem_school_brands b
   where b.school_id = v_school_id;
  v_prefix := coalesce(v_prefix,'DRM');

  select coalesce(max(c.card_version),0) + 1
    into v_version
    from public.dreem_student_credentials c
   where c.school_id = v_school_id
     and c.student_id = p_student_id;

  v_card_number := upper(regexp_replace(v_prefix || '-' || coalesce(v_matricule,p_student_id::text) || '-V' || v_version::text,'[^A-Za-z0-9-]+','','g'));

  update public.dreem_student_credentials c
     set status='revoked', revoked_at=now(), revoked_by=v_actor
   where c.school_id=v_school_id and c.student_id=p_student_id and c.status='active';

  insert into public.dreem_student_credentials(
    school_id,student_id,token_hash,valid_until,status,metadata,card_number,card_version
  ) values (
    v_school_id,p_student_id,encode(extensions.digest(v_token::text,'sha256'::text),'hex'),p_valid_until,'active',
    jsonb_build_object('issued_by',v_actor,'card_number',v_card_number,'card_version',v_version),v_card_number,v_version
  ) returning id into credential_id;

  perform private.dreem_write_event(
    v_school_id,'student_credential',credential_id,'credential.issued',concat('credential.issued:',p_idempotency_key),
    jsonb_build_object('student_id',p_student_id,'valid_until',p_valid_until,'card_number',v_card_number,'card_version',v_version)
  );

  verification_token := v_token;
  return next;
end;
$function$;

create or replace function public.dreem_verify_student_credential(p_token text)
returns table(school_name text, school_short_name text, student_display_name text, matricule text, current_class text, valid_until date, credential_status text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_school_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication is required.';
  end if;

  select c.school_id
    into v_school_id
    from public.dreem_student_credentials c
   where c.token_hash=encode(extensions.digest(p_token::text,'sha256'::text),'hex')
   limit 1;

  if v_school_id is null then
    return;
  end if;

  if not private.dreem_has_role(v_school_id,array['leadership','administrator','transport_manager','security_guard']) then
    raise exception 'Credential verification authorization is required.';
  end if;

  return query
  select sc.name,b.short_name,s.full_name,s.matricule,coalesce(s.class_name,''),c.valid_until,
    case when c.status='active' and c.valid_until>=current_date then 'valid' else c.status end
  from public.dreem_student_credentials c
  join public.students s on s.id=c.student_id and s.school_id=c.school_id
  join public.schools sc on sc.id=c.school_id
  left join public.dreem_school_brands b on b.school_id=c.school_id
  where c.token_hash=encode(extensions.digest(p_token::text,'sha256'::text),'hex')
  limit 1;
end;
$function$;

revoke all on function public.dreem_verify_student_credential(text) from public, anon;
grant execute on function public.dreem_verify_student_credential(text) to authenticated, service_role;
