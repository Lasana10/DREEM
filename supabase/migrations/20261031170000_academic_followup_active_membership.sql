-- A historical assignment is not sufficient to retain pupil/school operational access.
-- Existing membership statuses are approved, pending, suspended, rejected.
drop policy if exists dreem_academic_followups_read on public.dreem_academic_followups;
create policy dreem_academic_followups_read on public.dreem_academic_followups
 for select to authenticated using (
 (assigned_teacher=(select auth.uid()) and exists(
   select 1 from public.dreem_school_memberships m
   where m.school_id=dreem_academic_followups.school_id
   and m.profile_id=(select auth.uid()) and m.status='approved'
 ))
 or (select private.dreem_has_role(school_id,array['leadership','academic_head','auditor']))
 );

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
    where m.school_id=v_row.school_id and m.profile_id=v_actor and m.status='approved') then
  raise exception 'Current approved school membership required';end if;
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
revoke all on function public.dreem_respond_academic_followup(uuid,text,text) from public,anon;
grant execute on function public.dreem_respond_academic_followup(uuid,text,text) to authenticated;

-- Do not create new improvement work against a departed or suspended teacher.
create function private.dreem_guard_academic_followup_assignee()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.dreem_school_memberships m
   where m.school_id=new.school_id and m.profile_id=new.assigned_teacher and m.status='approved')
 then raise exception 'Assigned teacher must have approved school membership';end if;
 return new;
end;$$;
revoke all on function private.dreem_guard_academic_followup_assignee() from public,anon,authenticated;
create trigger dreem_academic_followup_active_teacher
 before insert on public.dreem_academic_followups
 for each row execute function private.dreem_guard_academic_followup_assignee();
