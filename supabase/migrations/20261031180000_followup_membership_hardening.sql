-- Enforce current school membership, not merely possession of a historical assignment ID.
drop policy dreem_academic_followups_read on public.dreem_academic_followups;
create policy dreem_academic_followups_read on public.dreem_academic_followups
 for select to authenticated using (
 (select private.dreem_has_role(school_id,array['leadership','academic_head','auditor']))
 or (assigned_teacher=(select auth.uid()) and exists(
  select 1 from public.dreem_school_memberships m
   where m.school_id=dreem_academic_followups.school_id
   and m.profile_id=(select auth.uid()) and m.status='approved'))
 );
create or replace function public.dreem_open_academic_followup(
 p_register_id uuid,p_marking_check_id uuid,p_title text,p_action text,p_due_date date
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_register public.dreem_weekly_teaching_registers%rowtype;
 v_check public.dreem_weekly_marking_checks%rowtype;v_id uuid;
begin
 select * into v_register from public.dreem_weekly_teaching_registers where id=p_register_id for share;
 if v_actor is null or not found then raise exception 'Weekly register not found';end if;
 if not private.dreem_has_role(v_register.school_id,array['leadership','academic_head'])
 or v_actor=v_register.submitted_by then
  raise exception 'Independent school leadership must assign academic follow-up';end if;
 if not exists(select 1 from public.dreem_school_memberships m
   where m.school_id=v_register.school_id and m.profile_id=v_register.submitted_by
   and m.status='approved' and m.role='teacher')
 then raise exception 'Assigned teacher must have approved current school membership';end if;
 if p_marking_check_id is not null then
  select * into v_check from public.dreem_weekly_marking_checks where id=p_marking_check_id;
  if not found or v_check.register_id<>p_register_id or v_check.school_id<>v_register.school_id
  then raise exception 'Marking check does not belong to this register';end if;
 end if;
 if length(trim(coalesce(p_title,''))) not between 5 and 160
 or length(trim(coalesce(p_action,''))) not between 10 and 2000
 or p_due_date is null or p_due_date<current_date or p_due_date>current_date+365 then
  raise exception 'Meaningful action and due date within one year are required';end if;
 insert into public.dreem_academic_followups(
  school_id,register_id,marking_check_id,assigned_teacher,title,required_action,due_date,created_by)
 values(v_register.school_id,p_register_id,p_marking_check_id,v_register.submitted_by,
  trim(p_title),trim(p_action),p_due_date,v_actor)
 returning id into v_id;
 perform private.dreem_write_event(v_register.school_id,'academic_followup',v_id,'academic_followup.opened',
  'academic-followup-open:'||v_id,jsonb_build_object('register_id',p_register_id,'due_date',p_due_date));
 return v_id;
end;$$;
create or replace function public.dreem_respond_academic_followup(
 p_followup_id uuid,p_response text,p_evidence text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_row public.dreem_academic_followups%rowtype;
begin
 select * into v_row from public.dreem_academic_followups where id=p_followup_id for update;
 if v_actor is null or not found or v_row.assigned_teacher<>v_actor
 or v_row.status not in ('open','returned') then
  raise exception 'Only the assigned teacher may respond to an open or returned follow-up';end if;
 if not exists(select 1 from public.dreem_school_memberships m
   where m.school_id=v_row.school_id and m.profile_id=v_actor and m.status='approved')
 then raise exception 'Current approved school membership required';end if;
 if length(trim(coalesce(p_response,''))) not between 10 and 2000
 or length(trim(coalesce(p_evidence,'')))<5 then
  raise exception 'Describe the completed action and its evidence reference';end if;
 update public.dreem_academic_followups set response=trim(p_response),
 response_evidence=left(trim(p_evidence),1000),responded_at=now(),
 status='responded',review_note=null,reviewed_at=null,reviewed_by=null,updated_at=now()
 where id=p_followup_id;
 perform private.dreem_write_event(v_row.school_id,'academic_followup',p_followup_id,'academic_followup.responded',
  'academic-followup-response:'||p_followup_id||':'||to_char(now(),'YYYYMMDDHH24MISSUS'),
  jsonb_build_object('teacher_id',v_actor));
 return p_followup_id;
end;$$;
revoke all on function public.dreem_open_academic_followup(uuid,uuid,text,text,date) from public,anon;
revoke all on function public.dreem_respond_academic_followup(uuid,text,text) from public,anon;
grant execute on function public.dreem_open_academic_followup(uuid,uuid,text,text,date) to authenticated;
grant execute on function public.dreem_respond_academic_followup(uuid,text,text) to authenticated;
