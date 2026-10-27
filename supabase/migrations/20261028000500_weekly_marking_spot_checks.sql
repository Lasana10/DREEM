-- School-scoped independent evidence for exercise-book marking supervision.
create table public.dreem_weekly_marking_checks(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 register_id uuid not null references public.dreem_weekly_teaching_registers(id) on delete cascade,
 sampled_books integer not null check(sampled_books between 1 and 200),
 decision text not null check(decision in ('verified','needs_correction','inconclusive')),
 evidence_reference text not null check(length(trim(evidence_reference)) between 5 and 500),
 findings text not null check(length(trim(findings)) between 10 and 2000),
 checked_by uuid not null references auth.users(id),
 checked_at timestamptz not null default now()
);
create index dreem_weekly_marking_check_register_idx
 on public.dreem_weekly_marking_checks(school_id,register_id,checked_at desc);
alter table public.dreem_weekly_marking_checks enable row level security;
revoke all on public.dreem_weekly_marking_checks from public,anon,authenticated;
grant select on public.dreem_weekly_marking_checks to authenticated;
create policy dreem_weekly_marking_checks_read on public.dreem_weekly_marking_checks
for select to authenticated using (
 (select private.dreem_has_role(school_id,array['leadership','academic_head','auditor']))
 or exists(select 1 from public.dreem_weekly_teaching_registers r
  where r.id=register_id and r.school_id=school_id and r.submitted_by=(select auth.uid()))
);
create trigger dreem_marking_checks_audit after insert or update or delete
 on public.dreem_weekly_marking_checks for each row execute function private.dreem_audit_row();
create function public.dreem_record_marking_check(
 p_register_id uuid,p_sampled_books integer,p_decision text,
 p_evidence_reference text,p_findings text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_register public.dreem_weekly_teaching_registers%rowtype;v_id uuid;
begin
 select * into v_register from public.dreem_weekly_teaching_registers where id=p_register_id;
 if v_actor is null or not found then raise exception 'Weekly register not found';end if;
 if not private.dreem_has_role(v_register.school_id,array['leadership','academic_head'])
 or v_actor=v_register.submitted_by then
  raise exception 'Independent academic leadership verification required';end if;
 if p_sampled_books not between 1 and 200
 or p_decision not in ('verified','needs_correction','inconclusive')
 or length(trim(coalesce(p_evidence_reference,''))) not between 5 and 500
 or length(trim(coalesce(p_findings,''))) not between 10 and 2000 then
  raise exception 'A valid sample, verification status, evidence reference and findings are required';end if;
 insert into public.dreem_weekly_marking_checks(
  school_id,register_id,sampled_books,decision,evidence_reference,findings,checked_by)
 values(v_register.school_id,p_register_id,p_sampled_books,p_decision,
  trim(p_evidence_reference),trim(p_findings),v_actor) returning id into v_id;
 perform private.dreem_write_event(v_register.school_id,'weekly_marking_check',v_id,'marking_check.recorded',
  'marking-check:'||v_id,jsonb_build_object('register_id',p_register_id,
  'sampled_books',p_sampled_books,'decision',p_decision));
 return v_id;
end;$$;
revoke all on function public.dreem_record_marking_check(uuid,integer,text,text,text) from public,anon;
grant execute on function public.dreem_record_marking_check(uuid,integer,text,text,text) to authenticated;
