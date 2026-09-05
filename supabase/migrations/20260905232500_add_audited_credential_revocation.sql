create or replace function public.dreem_revoke_student_credential(p_student_id uuid,p_reason text,p_idempotency_key text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare v_actor uuid:=(select auth.uid());v_school_id uuid;v_credential_id uuid;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'A revocation reason is required.';end if;
  if nullif(trim(coalesce(p_idempotency_key,'')),'') is null then raise exception 'An idempotency key is required.';end if;
  select s.school_id into v_school_id from public.students s where s.id=p_student_id;
  if v_school_id is null or not private.dreem_has_role(v_school_id,array['platform_founder','school_owner','principal','administrator']) then raise exception 'You are not authorized to revoke this credential.';end if;
  select c.id into v_credential_id from public.dreem_student_credentials c where c.school_id=v_school_id and c.student_id=p_student_id and c.status='active' order by c.issued_at desc limit 1 for update;
  if v_credential_id is null then return false;end if;
  update public.dreem_student_credentials set status='revoked',revoked_at=now(),revoked_by=v_actor,metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('revocation_reason',trim(p_reason)) where id=v_credential_id;
  perform private.dreem_write_event(v_school_id,'student_credential',v_credential_id,'credential.revoked',concat('credential.revoked:',p_idempotency_key),jsonb_build_object('student_id',p_student_id,'reason',trim(p_reason)));
  return true;
end;
$function$;
revoke all on function public.dreem_revoke_student_credential(uuid,text,text) from public,anon;
grant execute on function public.dreem_revoke_student_credential(uuid,text,text) to authenticated,service_role;