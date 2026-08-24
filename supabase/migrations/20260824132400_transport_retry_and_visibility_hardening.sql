-- DREEM-TRANSPORT-002: reliable consent replay and resource-scoped family visibility.

drop policy if exists dreem_transport_routes_read on public.dreem_transport_routes;
create policy dreem_transport_routes_read on public.dreem_transport_routes for select to authenticated using(
  (select private.dreem_has_role(school_id,array['leadership','administrator','transport_manager','driver','auditor']))
  or exists(select 1 from public.dreem_transport_assignments a where a.route_id=dreem_transport_routes.id and a.status='active' and (select private.dreem_can_view_student(a.school_id,a.student_id)))
);
drop policy if exists dreem_transport_stops_read on public.dreem_transport_stops;
create policy dreem_transport_stops_read on public.dreem_transport_stops for select to authenticated using(
  (select private.dreem_has_role(school_id,array['leadership','administrator','transport_manager','driver','auditor']))
  or exists(select 1 from public.dreem_transport_assignments a where a.route_id=dreem_transport_stops.route_id and a.status='active' and (select private.dreem_can_view_student(a.school_id,a.student_id)))
);

create or replace function public.dreem_record_transport_consent(p_student_id uuid,p_guardian_id uuid,p_decision text,p_guardian_name text,p_terms_version text,p_capture_method text,p_evidence jsonb,p_idempotency_key text)
returns table(consent_id uuid,consent_decision text) language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_school uuid:=private.dreem_transport_school();v_id uuid;v_existing public.dreem_transport_consents%rowtype;
begin
  if v_actor is null or v_school is null then raise exception 'Transport management authorization is required.';end if;
  select * into v_existing from public.dreem_transport_consents where school_id=v_school and idempotency_key=p_idempotency_key;
  if found then consent_id:=v_existing.id;consent_decision:=v_existing.decision;return next;return;end if;
  if p_decision not in('granted','revoked') or p_capture_method not in('signed_form','parent_portal','school_desk','verified_call') then raise exception 'Consent decision or capture method is invalid.';end if;
  if char_length(trim(coalesce(p_guardian_name,'')))<3 or nullif(trim(p_terms_version),'') is null then raise exception 'Guardian identity and consent terms are required.';end if;
  if nullif(trim(coalesce(p_evidence->>'note','')),'') is null then raise exception 'Consent evidence is required.';end if;
  if not exists(select 1 from public.students s where s.id=p_student_id and s.school_id=v_school) then raise exception 'Learner does not belong to this school.';end if;
  if p_guardian_id is not null and not exists(select 1 from public.dreem_student_guardians g where g.student_id=p_student_id and g.guardian_id=p_guardian_id and g.school_id=v_school) then raise exception 'Guardian is not linked to this learner.';end if;
  insert into public.dreem_transport_consents(school_id,student_id,guardian_id,decision,terms_version,capture_method,guardian_name,evidence,captured_by,idempotency_key) values(v_school,p_student_id,p_guardian_id,p_decision,trim(p_terms_version),p_capture_method,trim(p_guardian_name),p_evidence,v_actor,p_idempotency_key) returning id,decision into v_id,consent_decision;
  perform private.dreem_write_event(v_school,'student',p_student_id,concat('transport.consent_',p_decision),concat('transport.consent:',p_idempotency_key),jsonb_build_object('consent_id',v_id,'guardian_id',p_guardian_id,'terms_version',p_terms_version));consent_id:=v_id;return next;
end;$$;
