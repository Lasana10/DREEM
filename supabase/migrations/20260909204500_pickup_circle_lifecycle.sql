-- DREEM-SAFETY-002: persistent multi-person Pickup Circle lifecycle.
alter table public.dreem_authorized_collectors drop constraint if exists dreem_authorized_collectors_status_check;
alter table public.dreem_authorized_collectors add constraint dreem_authorized_collectors_status_check check(status in ('active','suspended','revoked','expired'));

create or replace function public.dreem_set_collector_status(p_collector_id uuid,p_status text,p_reason text,p_idempotency_key text)
returns table(collector_id uuid,collector_status text)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_row public.dreem_authorized_collectors%rowtype;
begin
 if v_actor is null then raise exception 'Authentication is required.'; end if;
 select * into v_row from public.dreem_authorized_collectors c where c.id=p_collector_id;
 if not found then raise exception 'Collector authorization was not found.'; end if;
 if not private.dreem_has_role(v_row.school_id,array['leadership','administrator']) then raise exception 'School administration authorization is required.'; end if;
 if p_status not in ('active','suspended','revoked') then raise exception 'Unsupported collector status.'; end if;
 if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'A reason is required.'; end if;
 update public.dreem_authorized_collectors c set status=p_status,revoked_by=case when p_status='revoked' then v_actor else null end,revoked_at=case when p_status='revoked' then now() else null end,evidence=coalesce(c.evidence,'{}'::jsonb)||jsonb_build_object('last_status_reason',trim(p_reason),'last_status_at',now()),updated_at=now() where c.id=p_collector_id;
 perform private.dreem_write_event(v_row.school_id,'student',v_row.student_id,concat('safety.collector_',p_status),concat('safety.collector-status:',p_idempotency_key),jsonb_build_object('collector_id',p_collector_id,'reason',trim(p_reason)));
 collector_id:=p_collector_id;collector_status:=p_status;return next;
end;$$;
revoke all on function public.dreem_set_collector_status(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.dreem_set_collector_status(uuid,text,text,text) to authenticated;

create or replace function public.dreem_get_pickup_circle(p_student_id uuid)
returns table(collector_id uuid,full_name text,relationship text,phone_last4 text,photo_url text,valid_from timestamptz,valid_until timestamptz,collector_status text,last_decision text,last_release_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_school uuid;
begin
 select s.school_id into v_school from public.students s where s.id=p_student_id;
 if v_school is null or not ((select private.dreem_has_role(v_school,array['leadership','administrator','transport_manager','security_guard','auditor'])) or (select private.dreem_can_view_student(v_school,p_student_id))) then raise exception 'Pickup Circle access is not authorized.'; end if;
 return query select c.id,c.full_name,c.relationship,c.phone_last4,c.photo_url,c.valid_from,c.valid_until,case when c.status='active' and c.valid_until is not null and c.valid_until<now() then 'expired' else c.status end,e.decision,e.recorded_at
 from public.dreem_authorized_collectors c
 left join lateral (select r.decision,r.recorded_at from public.dreem_learner_release_events r where r.collector_id=c.id order by r.recorded_at desc limit 1) e on true
 where c.school_id=v_school and c.student_id=p_student_id
 order by (case when c.status='active' and (c.valid_until is null or c.valid_until>=now()) then 0 else 1 end),c.full_name;
end;$$;
revoke all on function public.dreem_get_pickup_circle(uuid) from public,anon,authenticated;
grant execute on function public.dreem_get_pickup_circle(uuid) to authenticated;
