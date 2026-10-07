-- Keep the new technical authority first-class in position editors and access review.

create or replace function public.dreem_set_position(
  p_school_id uuid,p_membership_id uuid,p_title text,p_category text,p_scopes text[]
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_position_id uuid; v_code text; v_scope text;
begin
  if not public.dreem_has_authority(p_school_id,'staff_management')
     and not public.dreem_has_authority(p_school_id,'school_configuration') then
    raise exception 'This account cannot manage institutional positions';
  end if;
  if nullif(trim(p_title),'') is null then raise exception 'Position title is required'; end if;
  if p_category not in ('governance','leadership','academic','finance','operations','support','audit') then raise exception 'Invalid position category'; end if;
  if not exists(select 1 from public.dreem_school_memberships m where m.id=p_membership_id and m.school_id=p_school_id and m.status='approved') then
    raise exception 'Approved membership not found in this school';
  end if;
  v_code:='custom-'||replace(p_membership_id::text,'-','');
  insert into public.dreem_school_positions(school_id,code,title,category,created_by)
  values(p_school_id,v_code,trim(p_title),p_category,(select auth.uid()))
  on conflict(school_id,code) do update set title=excluded.title,category=excluded.category,is_active=true,updated_at=now()
  returning id into v_position_id;
  delete from public.dreem_position_authorities where position_id=v_position_id;
  foreach v_scope in array coalesce(p_scopes,array[]::text[]) loop
    if v_scope not in ('institutional_leadership','academics_delivery','academics_approval','admissions_intake','admissions_decision','finance_collection','finance_approval','safeguarding','transport_management','transport_operation','gate','staff_management','communications_publish','communications_approve','audit','school_configuration','technical_operations') then
      raise exception 'Invalid authority scope: %',v_scope;
    end if;
    insert into public.dreem_position_authorities(position_id,scope) values(v_position_id,v_scope) on conflict do nothing;
  end loop;
  update public.dreem_position_assignments set is_primary=false,updated_at=now() where membership_id=p_membership_id and status='active';
  insert into public.dreem_position_assignments(school_id,membership_id,position_id,is_primary,status,assigned_by)
  values(p_school_id,p_membership_id,v_position_id,true,'active',(select auth.uid()))
  on conflict(membership_id,position_id) do update set is_primary=true,status='active',updated_at=now();
  insert into public.audit_events(school_id,actor_id,action,entity_type,entity_id,detail)
  values(p_school_id,(select auth.uid()),'institution.position_assigned','school_membership',p_membership_id,
    jsonb_build_object('position_id',v_position_id,'title',trim(p_title),'category',p_category,'scopes',coalesce(p_scopes,array[]::text[])));
  return v_position_id;
end;
$$;

create or replace function public.dreem_upsert_school_position(
  p_school_id uuid,p_position_id uuid,p_code text,p_title text,p_category text,p_scopes text[]
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_position_id uuid; v_scope text;
begin
  if not public.dreem_has_authority(p_school_id,'staff_management')
     and not public.dreem_has_authority(p_school_id,'school_configuration') then
    raise exception 'This account cannot manage institutional positions';
  end if;
  if nullif(trim(p_title),'') is null then raise exception 'Position title is required'; end if;
  if nullif(trim(p_code),'') is null then raise exception 'Position code is required'; end if;
  if p_category not in ('governance','leadership','academic','finance','operations','support','audit') then raise exception 'Invalid position category'; end if;
  if p_position_id is null then
    insert into public.dreem_school_positions(school_id,code,title,category,created_by)
    values(p_school_id,lower(regexp_replace(trim(p_code),'[^a-zA-Z0-9]+','-','g')),trim(p_title),p_category,(select auth.uid()))
    returning id into v_position_id;
  else
    update public.dreem_school_positions
    set code=lower(regexp_replace(trim(p_code),'[^a-zA-Z0-9]+','-','g')),title=trim(p_title),category=p_category,is_active=true,updated_at=now()
    where id=p_position_id and school_id=p_school_id returning id into v_position_id;
    if v_position_id is null then raise exception 'Position not found in this school'; end if;
  end if;
  delete from public.dreem_position_authorities where position_id=v_position_id;
  foreach v_scope in array coalesce(p_scopes,array[]::text[]) loop
    if v_scope not in ('institutional_leadership','academics_delivery','academics_approval','admissions_intake','admissions_decision','finance_collection','finance_approval','safeguarding','transport_management','transport_operation','gate','staff_management','communications_publish','communications_approve','audit','school_configuration','technical_operations') then
      raise exception 'Invalid authority scope: %',v_scope;
    end if;
    insert into public.dreem_position_authorities(position_id,scope) values(v_position_id,v_scope) on conflict do nothing;
  end loop;
  insert into public.audit_events(school_id,actor_id,action,entity_type,entity_id,detail)
  values(p_school_id,(select auth.uid()),case when p_position_id is null then 'institution.position_created' else 'institution.position_updated' end,
    'school_position',v_position_id,jsonb_build_object('title',trim(p_title),'category',p_category,'scopes',coalesce(p_scopes,array[]::text[])));
  return v_position_id;
end;
$$;

create or replace function public.dreem_update_membership_status(p_membership_id uuid,p_status text)
returns table(membership_id uuid,membership_status text)
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid()); v_school_id uuid; v_target_profile uuid; v_target_role text; v_actor_role text;
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
  if v_actor_role='administrator' and v_target_role in ('platform_founder','school_owner','principal','administrator','academic_head','it_admin') then
    raise exception 'Administrators cannot change leadership, administrative or IT memberships.';
  end if;
  if v_actor_role='principal' and v_target_role in ('platform_founder','school_owner') then raise exception 'Principals cannot change founder or owner memberships.'; end if;
  if v_actor_role='school_owner' and v_target_role='platform_founder' then raise exception 'Only the founder can govern founder membership.'; end if;
  update public.dreem_school_memberships set status=p_status,reviewed_by=v_actor,reviewed_at=now(),updated_at=now()
  where id=p_membership_id returning id,status into membership_id,membership_status;
  perform private.dreem_write_event(v_school_id,'membership',p_membership_id,'membership.status_changed',
    concat('membership.status:',p_membership_id,':',p_status),jsonb_build_object('status',p_status,'target_role',v_target_role,'actor_role',v_actor_role));
  return next;
end;
$$;

revoke all on function public.dreem_set_position(uuid,uuid,text,text,text[]) from public,anon;
revoke all on function public.dreem_upsert_school_position(uuid,uuid,text,text,text,text[]) from public,anon;
revoke all on function public.dreem_update_membership_status(uuid,text) from public,anon;
grant execute on function public.dreem_set_position(uuid,uuid,text,text,text[]) to authenticated;
grant execute on function public.dreem_upsert_school_position(uuid,uuid,text,text,text,text[]) to authenticated;
grant execute on function public.dreem_update_membership_status(uuid,text) to authenticated;