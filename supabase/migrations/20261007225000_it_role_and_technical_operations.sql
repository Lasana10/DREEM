-- Add a least-privilege IT archetype without granting school-governance powers.

alter table public.dreem_school_memberships drop constraint if exists dreem_school_memberships_role_check;
alter table public.dreem_school_memberships add constraint dreem_school_memberships_role_check
check (role = any(array[
  'platform_founder','school_owner','principal','administrator','academic_head',
  'bursar','accountant','teacher','tutor','transport_manager','driver',
  'security_guard','parent','student','auditor','it_admin'
]::text[]));

alter table public.dreem_staff_invitations drop constraint if exists dreem_staff_invitations_role_check;
alter table public.dreem_staff_invitations add constraint dreem_staff_invitations_role_check
check (role = any(array[
  'school_owner','principal','administrator','academic_head','bursar','accountant',
  'teacher','tutor','transport_manager','driver','security_guard','auditor','it_admin'
]::text[]));

alter table public.dreem_position_authorities drop constraint if exists dreem_position_authorities_scope_check;
alter table public.dreem_position_authorities add constraint dreem_position_authorities_scope_check
check (scope = any(array[
  'institutional_leadership','academics_delivery','academics_approval','admissions_intake',
  'admissions_decision','finance_collection','finance_approval','safeguarding',
  'transport_management','transport_operation','gate','staff_management',
  'communications_publish','communications_approve','audit','school_configuration',
  'technical_operations'
]::text[]));

create or replace function private.dreem_legacy_authority_scopes(p_role text)
returns text[]
language sql
immutable
set search_path=''
as $$
  select case p_role
    when 'platform_founder' then array['institutional_leadership','academics_delivery','academics_approval','admissions_intake','admissions_decision','finance_collection','finance_approval','safeguarding','transport_management','transport_operation','gate','staff_management','communications_publish','communications_approve','audit','school_configuration','technical_operations']::text[]
    when 'school_owner' then array['institutional_leadership','academics_approval','admissions_decision','finance_approval','safeguarding','transport_management','staff_management','communications_publish','communications_approve','audit','school_configuration','technical_operations']::text[]
    when 'principal' then array['institutional_leadership','academics_approval','admissions_decision','finance_approval','safeguarding','transport_management','staff_management','communications_publish','communications_approve','school_configuration']::text[]
    when 'administrator' then array['admissions_intake','staff_management','communications_publish','school_configuration']::text[]
    when 'academic_head' then array['academics_approval','admissions_decision','communications_publish']::text[]
    when 'bursar' then array['finance_collection']::text[]
    when 'accountant' then array['finance_approval','audit']::text[]
    when 'teacher' then array['academics_delivery']::text[]
    when 'tutor' then array['academics_delivery']::text[]
    when 'transport_manager' then array['transport_management','communications_publish']::text[]
    when 'driver' then array['transport_operation']::text[]
    when 'security_guard' then array['gate']::text[]
    when 'auditor' then array['audit']::text[]
    when 'it_admin' then array['technical_operations']::text[]
    else array[]::text[]
  end;
$$;

revoke all on function private.dreem_legacy_authority_scopes(text) from public;
grant execute on function private.dreem_legacy_authority_scopes(text) to authenticated;

create or replace function public.dreem_invite_staff(p_email text,p_full_name text,p_role text,p_idempotency_key text)
returns table(invitation_id uuid, invitation_status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_school uuid;
  v_actor_role text;
  v_id uuid;
begin
  if v_actor is null then raise exception 'Authentication is required.'; end if;

  select m.school_id,m.role into v_school,v_actor_role
  from public.dreem_school_memberships m
  where m.profile_id=v_actor and m.status='approved'
    and m.role in ('platform_founder','school_owner','principal','administrator')
  order by case m.role when 'platform_founder' then 0 when 'school_owner' then 1 when 'principal' then 2 else 3 end
  limit 1;

  if v_school is null then raise exception 'You are not authorized to invite staff.'; end if;
  if p_role not in('school_owner','principal','administrator','academic_head','bursar','accountant','teacher','tutor','transport_manager','driver','security_guard','auditor','it_admin') then
    raise exception 'Unsupported staff role.';
  end if;

  if v_actor_role='administrator' and p_role in ('school_owner','principal','administrator','academic_head','it_admin') then
    raise exception 'Administrators cannot grant leadership, administrative or IT roles.';
  end if;
  if v_actor_role='principal' and p_role='school_owner' then
    raise exception 'Principals cannot grant owner access.';
  end if;

  if nullif(trim(p_email),'') is null or char_length(trim(coalesce(p_full_name,'')))<3 then
    raise exception 'Staff email and full name are required.';
  end if;
  if nullif(trim(coalesce(p_idempotency_key,'')),'') is null then raise exception 'An idempotency key is required.'; end if;

  insert into public.dreem_staff_invitations(school_id,email,full_name,role,invited_by,token_hash)
  values(v_school,lower(trim(p_email)),trim(p_full_name),p_role,v_actor,encode(public.digest(concat(p_idempotency_key,':',lower(trim(p_email))),'sha256'),'hex'))
  on conflict(school_id,email,role) do update
  set full_name=excluded.full_name,status='pending',updated_at=now(),invited_by=v_actor
  returning id,status into v_id,invitation_status;

  perform private.dreem_write_event(v_school,'staff_invitation',v_id,'staff.invited',concat('staff.invited:',p_idempotency_key),
    jsonb_build_object('email',lower(trim(p_email)),'role',p_role,'actor_role',v_actor_role));
  invitation_id:=v_id;
  return next;
end;
$$;
revoke all on function public.dreem_invite_staff(text,text,text,text) from public,anon;
grant execute on function public.dreem_invite_staff(text,text,text,text) to authenticated;

create or replace function public.dreem_technical_status()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_school uuid;
begin
  select m.school_id into v_school
  from public.dreem_school_memberships m
  where m.profile_id=(select auth.uid()) and m.status='approved'
    and (m.role='it_admin' or public.dreem_has_authority(m.school_id,'technical_operations'))
  limit 1;
  if v_school is null then raise exception 'Technical operations authority is required.'; end if;

  return jsonb_build_object(
    'school_id',v_school,
    'queued_notifications',(select count(*) from public.dreem_notification_deliveries n where n.school_id=v_school and n.status in ('queued','retrying')),
    'failed_notifications',(select count(*) from public.dreem_notification_deliveries n where n.school_id=v_school and n.status='failed'),
    'offline_pending',(select count(*) from public.dreem_offline_operation_receipts o where o.school_id=v_school and o.status='pending'),
    'offline_rejected',(select count(*) from public.dreem_offline_operation_receipts o where o.school_id=v_school and o.status='rejected'),
    'approved_memberships',(select count(*) from public.dreem_school_memberships m where m.school_id=v_school and m.status='approved'),
    'generated_at',now()
  );
end;
$$;
revoke all on function public.dreem_technical_status() from public,anon;
grant execute on function public.dreem_technical_status() to authenticated;
