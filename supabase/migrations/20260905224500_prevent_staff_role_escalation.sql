create or replace function public.dreem_invite_staff(p_email text, p_full_name text, p_role text, p_idempotency_key text)
returns table(invitation_id uuid, invitation_status text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_school uuid;
  v_actor_role text;
  v_id uuid;
begin
  if v_actor is null then raise exception 'Authentication is required.'; end if;

  select m.school_id, m.role
    into v_school, v_actor_role
    from public.dreem_school_memberships m
   where m.profile_id=v_actor and m.status='approved'
     and m.role in ('platform_founder','school_owner','principal','administrator')
   order by case m.role when 'platform_founder' then 0 when 'school_owner' then 1 when 'principal' then 2 else 3 end
   limit 1;

  if v_school is null then raise exception 'You are not authorized to invite staff.'; end if;
  if p_role not in('school_owner','principal','administrator','academic_head','bursar','accountant','teacher','tutor','transport_manager','driver','security_guard','auditor') then raise exception 'Unsupported staff role.'; end if;

  if v_actor_role='administrator' and p_role in ('school_owner','principal','administrator','academic_head') then raise exception 'Administrators cannot grant leadership or administrative roles.'; end if;
  if v_actor_role='principal' and p_role='school_owner' then raise exception 'Principals cannot grant owner access.'; end if;

  if nullif(trim(p_email),'') is null or char_length(trim(coalesce(p_full_name,'')))<3 then raise exception 'Staff email and full name are required.'; end if;
  if nullif(trim(coalesce(p_idempotency_key,'')),'') is null then raise exception 'An idempotency key is required.'; end if;

  insert into public.dreem_staff_invitations(school_id,email,full_name,role,invited_by,token_hash)
  values(v_school,lower(trim(p_email)),trim(p_full_name),p_role,v_actor,encode(public.digest(concat(p_idempotency_key,':',lower(trim(p_email))),'sha256'),'hex'))
  on conflict(school_id,email,role) do update set full_name=excluded.full_name,status='pending',updated_at=now(),invited_by=v_actor
  returning id,status into v_id,invitation_status;

  perform private.dreem_write_event(v_school,'staff_invitation',v_id,'staff.invited',concat('staff.invited:',p_idempotency_key),jsonb_build_object('email',lower(trim(p_email)),'role',p_role,'actor_role',v_actor_role));
  invitation_id:=v_id; return next;
end;
$function$;

create or replace function public.dreem_update_membership_status(p_membership_id uuid, p_status text)
returns table(membership_id uuid, membership_status text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_school_id uuid;
  v_target_profile uuid;
  v_target_role text;
  v_actor_role text;
begin
  if v_actor is null then raise exception 'Authentication is required.'; end if;
  if p_status not in ('pending','approved','suspended','rejected') then raise exception 'Unsupported membership status.'; end if;

  select m.school_id,m.profile_id,m.role into v_school_id,v_target_profile,v_target_role from public.dreem_school_memberships m where m.id=p_membership_id;
  if v_school_id is null then raise exception 'Membership was not found.'; end if;

  select m.role into v_actor_role from public.dreem_school_memberships m
   where m.school_id=v_school_id and m.profile_id=v_actor and m.status='approved'
     and m.role in ('platform_founder','school_owner','principal','administrator')
   order by case m.role when 'platform_founder' then 0 when 'school_owner' then 1 when 'principal' then 2 else 3 end limit 1;

  if v_actor_role is null then raise exception 'You are not authorized to update this membership.'; end if;
  if v_target_profile=v_actor then raise exception 'You cannot change your own membership status through this workflow.'; end if;
  if v_actor_role='administrator' and v_target_role in ('platform_founder','school_owner','principal','administrator','academic_head') then raise exception 'Administrators cannot change leadership or administrative memberships.'; end if;
  if v_actor_role='principal' and v_target_role in ('platform_founder','school_owner') then raise exception 'Principals cannot change founder or owner memberships.'; end if;
  if v_actor_role='school_owner' and v_target_role='platform_founder' then raise exception 'Only the founder can govern founder membership.'; end if;

  update public.dreem_school_memberships set status=p_status,reviewed_by=v_actor,reviewed_at=now(),updated_at=now()
   where id=p_membership_id returning id,status into membership_id,membership_status;

  perform private.dreem_write_event(v_school_id,'membership',p_membership_id,'membership.status_changed',concat('membership.status:',p_membership_id,':',p_status),jsonb_build_object('status',p_status,'target_role',v_target_role,'actor_role',v_actor_role));
  return next;
end;
$function$;

revoke all on function public.dreem_invite_staff(text,text,text,text) from public, anon;
revoke all on function public.dreem_update_membership_status(uuid,text) from public, anon;
grant execute on function public.dreem_invite_staff(text,text,text,text) to authenticated, service_role;
grant execute on function public.dreem_update_membership_status(uuid,text) to authenticated, service_role;