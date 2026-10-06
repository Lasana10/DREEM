create or replace function public.dreem_correct_learner_identity(
  p_student_id uuid,
  p_full_name text,
  p_class_name text,
  p_date_of_birth date,
  p_sex text,
  p_idempotency_key text
) returns boolean
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_school uuid;
begin
  if v_actor is null then raise exception 'Authentication is required.'; end if;
  select school_id into v_school from public.students where id=p_student_id and merged_into_student_id is null;
  if v_school is null then raise exception 'Learner record was not found.'; end if;
  if not (
    public.dreem_has_authority(v_school,'admissions_intake')
    or public.dreem_has_authority(v_school,'admissions_decision')
    or public.dreem_has_authority(v_school,'school_configuration')
    or public.dreem_has_authority(v_school,'institutional_leadership')
  ) then raise exception 'You are not authorized to correct learner identity.'; end if;
  if char_length(trim(coalesce(p_full_name,'')))<3 then raise exception 'Learner full name is required.'; end if;
  if char_length(trim(coalesce(p_class_name,'')))<1 then raise exception 'Learner class is required.'; end if;
  if p_sex is not null and p_sex not in ('female','male','other') then raise exception 'Unsupported learner sex value.'; end if;
  update public.students set full_name=trim(p_full_name),class_name=trim(p_class_name),date_of_birth=p_date_of_birth,sex=nullif(p_sex,''),updated_at=now() where id=p_student_id;
  perform private.dreem_write_event(v_school,'student',p_student_id,'learner.identity_corrected',concat('learner-identity:',p_idempotency_key),jsonb_build_object('actor',v_actor,'class_name',trim(p_class_name)));
  return true;
end; $$;

create or replace function public.dreem_correct_guardian_profile(
  p_student_id uuid,
  p_guardian_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_relationship text,
  p_idempotency_key text
) returns boolean
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_school uuid;
begin
  if v_actor is null then raise exception 'Authentication is required.'; end if;
  select sg.school_id into v_school from public.dreem_student_guardians sg where sg.student_id=p_student_id and sg.guardian_id=p_guardian_id;
  if v_school is null then raise exception 'Guardian link was not found.'; end if;
  if not (
    public.dreem_has_authority(v_school,'admissions_intake')
    or public.dreem_has_authority(v_school,'admissions_decision')
    or public.dreem_has_authority(v_school,'school_configuration')
    or public.dreem_has_authority(v_school,'institutional_leadership')
  ) then raise exception 'You are not authorized to correct guardian identity.'; end if;
  if char_length(trim(coalesce(p_full_name,'')))<3 then raise exception 'Guardian full name is required.'; end if;
  if char_length(trim(coalesce(p_relationship,'')))<1 then raise exception 'Guardian relationship is required.'; end if;
  update public.dreem_guardians set full_name=trim(p_full_name),phone=nullif(trim(coalesce(p_phone,'')),''),email=nullif(trim(coalesce(p_email,'')),''),updated_at=now() where id=p_guardian_id and school_id=v_school;
  update public.dreem_student_guardians set relationship=trim(p_relationship) where student_id=p_student_id and guardian_id=p_guardian_id and school_id=v_school;
  perform private.dreem_write_event(v_school,'guardian',p_guardian_id,'guardian.identity_corrected',concat('guardian-identity:',p_idempotency_key),jsonb_build_object('actor',v_actor,'student_id',p_student_id,'relationship',trim(p_relationship)));
  return true;
end; $$;

revoke all on function public.dreem_correct_learner_identity(uuid,text,text,date,text,text) from public,anon;
grant execute on function public.dreem_correct_learner_identity(uuid,text,text,date,text,text) to authenticated;
revoke all on function public.dreem_correct_guardian_profile(uuid,uuid,text,text,text,text,text) from public,anon;
grant execute on function public.dreem_correct_guardian_profile(uuid,uuid,text,text,text,text,text) to authenticated;
