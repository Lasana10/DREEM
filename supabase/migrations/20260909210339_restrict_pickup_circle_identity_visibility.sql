-- DREEM-SAFETY-003: Pickup Circle identities are private family/school-administration data.
-- Teachers who can view a learner academically must not inherit pickup identity/history access.
-- Gate verification remains a purpose-specific verification workflow rather than a browse permission.
create or replace function public.dreem_get_pickup_circle(p_student_id uuid)
returns table(collector_id uuid,full_name text,relationship text,phone_last4 text,photo_url text,valid_from timestamptz,valid_until timestamptz,collector_status text,last_decision text,last_release_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_school uuid; v_actor uuid := (select auth.uid());
begin
 if v_actor is null then raise exception 'Authentication is required.'; end if;
 select s.school_id into v_school from public.students s where s.id=p_student_id;
 if v_school is null then raise exception 'Learner was not found.'; end if;
 if not (
   private.dreem_has_role(v_school,array['leadership','administrator','transport_manager','auditor'])
   or exists(select 1 from public.students s where s.id=p_student_id and s.school_id=v_school and (s.profile_id=v_actor or v_actor=any(coalesce(s.parent_user_ids,array[]::uuid[]))))
 ) then raise exception 'Pickup Circle access is not authorized.'; end if;
 return query select c.id,c.full_name,c.relationship,c.phone_last4,c.photo_url,c.valid_from,c.valid_until,
   case when c.status='active' and c.valid_until is not null and c.valid_until<now() then 'expired' else c.status end,
   e.decision,e.recorded_at
 from public.dreem_authorized_collectors c
 left join lateral (select r.decision,r.recorded_at from public.dreem_learner_release_events r where r.collector_id=c.id order by r.recorded_at desc limit 1) e on true
 where c.school_id=v_school and c.student_id=p_student_id
 order by (case when c.status='active' and (c.valid_until is null or c.valid_until>=now()) then 0 else 1 end),c.full_name;
end;$$;
revoke all on function public.dreem_get_pickup_circle(uuid) from public,anon,authenticated;
grant execute on function public.dreem_get_pickup_circle(uuid) to authenticated;
