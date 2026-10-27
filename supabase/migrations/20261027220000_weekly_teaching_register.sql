-- Weekly teaching declarations complement, rather than replace, existing lesson plans.
-- There is deliberately no pupil-data migration or public write policy.
create table if not exists public.dreem_weekly_teaching_registers (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 teaching_assignment_id uuid not null references public.dreem_teaching_assignments(id) on delete cascade,
 week_start date not null,
 lessons_delivered integer not null check(lessons_delivered between 0 and 40),
 exercises_assigned integer not null check(exercises_assigned between 0 and 100),
 marking_state text not null check(marking_state in ('not_applicable','pending','partial','completed')),
 curriculum_progress text not null check(length(trim(curriculum_progress)) between 5 and 2000),
 learner_difficulties text not null default '',
 evidence_reference text not null default '',
 teacher_note text not null default '',
 status text not null default 'submitted' check(status in ('submitted','approved','returned')),
 submitted_by uuid not null references auth.users(id),
 submitted_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 review_note text,
 updated_at timestamptz not null default now(),
 unique(teaching_assignment_id,week_start),
 check(extract(isodow from week_start)=1)
);
create index if not exists dreem_weekly_register_school_week_idx
 on public.dreem_weekly_teaching_registers(school_id,week_start desc,status);
alter table public.dreem_weekly_teaching_registers enable row level security;
revoke all on public.dreem_weekly_teaching_registers from public,anon,authenticated;
grant select on public.dreem_weekly_teaching_registers to authenticated;
create policy dreem_weekly_register_read on public.dreem_weekly_teaching_registers
 for select to authenticated using (
 submitted_by=(select auth.uid())
 or (select private.dreem_has_role(school_id,array['leadership','academic_head','auditor']))
);
create trigger dreem_weekly_register_audit after insert or update or delete
 on public.dreem_weekly_teaching_registers for each row execute function private.dreem_audit_row();

create function public.dreem_submit_weekly_register(
 p_assignment_id uuid,p_week_start date,p_lessons_delivered integer,
 p_exercises_assigned integer,p_marking_state text,p_curriculum_progress text,
 p_learner_difficulties text,p_evidence_reference text,p_teacher_note text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_assignment public.dreem_teaching_assignments%rowtype;
 v_id uuid; v_old public.dreem_weekly_teaching_registers%rowtype;
begin
 if v_actor is null then raise exception 'Authentication required';end if;
 select * into v_assignment from public.dreem_teaching_assignments where id=p_assignment_id and status='active';
 if not found or v_assignment.teacher_user_id<>v_actor then
  raise exception 'Only the assigned active teacher may submit this weekly register';end if;
 if p_week_start is null or extract(isodow from p_week_start)<>1
 or p_lessons_delivered not between 0 and 40 or p_exercises_assigned not between 0 and 100
 or p_marking_state not in ('not_applicable','pending','partial','completed')
 or length(trim(coalesce(p_curriculum_progress,''))) not between 5 and 2000 then
  raise exception 'A Monday date, valid counts, marking state and progress summary are required';end if;
 select * into v_old from public.dreem_weekly_teaching_registers
 where teaching_assignment_id=p_assignment_id and week_start=p_week_start for update;
 if found and v_old.status<>'returned' then
  raise exception 'This week has already been submitted. Only returned registers can be resubmitted.';end if;
 insert into public.dreem_weekly_teaching_registers(
 school_id,teaching_assignment_id,week_start,lessons_delivered,exercises_assigned,
 marking_state,curriculum_progress,learner_difficulties,evidence_reference,teacher_note,submitted_by
 ) values(
 v_assignment.school_id,p_assignment_id,p_week_start,p_lessons_delivered,p_exercises_assigned,
 p_marking_state,trim(p_curriculum_progress),left(trim(coalesce(p_learner_difficulties,'')),2000),
 left(trim(coalesce(p_evidence_reference,'')),1000),left(trim(coalesce(p_teacher_note,'')),2000),v_actor
 ) on conflict(teaching_assignment_id,week_start) do update set
 lessons_delivered=excluded.lessons_delivered,exercises_assigned=excluded.exercises_assigned,
 marking_state=excluded.marking_state,curriculum_progress=excluded.curriculum_progress,
 learner_difficulties=excluded.learner_difficulties,evidence_reference=excluded.evidence_reference,
 teacher_note=excluded.teacher_note,status='submitted',submitted_by=v_actor,submitted_at=now(),
 reviewed_by=null,reviewed_at=null,review_note=null,updated_at=now()
 returning id into v_id;
 perform private.dreem_write_event(v_assignment.school_id,'weekly_teaching_register',v_id,
 'weekly_register.submitted','weekly-register-submitted:'||v_id||':'||p_week_start::text,
 jsonb_build_object('assignment_id',p_assignment_id,'week_start',p_week_start));
 return v_id;
end;$$;

create function public.dreem_review_weekly_register(
 p_register_id uuid,p_decision text,p_note text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_row public.dreem_weekly_teaching_registers%rowtype;
begin
 select * into v_row from public.dreem_weekly_teaching_registers where id=p_register_id for update;
 if v_actor is null or not found then raise exception 'Register not found';end if;
 if not private.dreem_has_role(v_row.school_id,array['leadership','academic_head']) then
  raise exception 'Academic approval permission required';end if;
 if v_row.submitted_by=v_actor then raise exception 'You cannot review your own submission';end if;
 if v_row.status<>'submitted' then raise exception 'Only submitted registers can be reviewed';end if;
 if p_decision not in ('approved','returned') or length(trim(coalesce(p_note,'')))<5 then
  raise exception 'A valid decision and meaningful review note are required';end if;
 update public.dreem_weekly_teaching_registers set status=p_decision,review_note=trim(p_note),
 reviewed_by=v_actor,reviewed_at=now(),updated_at=now() where id=p_register_id;
 perform private.dreem_write_event(v_row.school_id,'weekly_teaching_register',p_register_id,
 'weekly_register.'||p_decision,'weekly-register-review:'||p_register_id||':'||p_decision,
 jsonb_build_object('note',trim(p_note)));
 return p_register_id;
end;$$;
revoke all on function public.dreem_submit_weekly_register(uuid,date,integer,integer,text,text,text,text,text) from public,anon;
revoke all on function public.dreem_review_weekly_register(uuid,text,text) from public,anon;
grant execute on function public.dreem_submit_weekly_register(uuid,date,integer,integer,text,text,text,text,text) to authenticated;
grant execute on function public.dreem_review_weekly_register(uuid,text,text) to authenticated;
