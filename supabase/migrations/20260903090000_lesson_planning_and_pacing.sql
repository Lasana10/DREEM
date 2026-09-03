create table public.dreem_lesson_plans(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teaching_assignment_id uuid not null references public.dreem_teaching_assignments(id) on delete cascade,
  lesson_date date not null,
  title text not null check(length(trim(title)) > 0),
  objectives text not null check(length(trim(objectives)) >= 5),
  learning_activity text not null check(length(trim(learning_activity)) >= 5),
  evidence text not null check(length(trim(evidence)) >= 3),
  follow_up text,
  status text not null default 'submitted' check(status in('submitted','reviewed','returned')),
  created_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  reviewer_note text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,idempotency_key)
);

alter table public.dreem_lesson_plans enable row level security;
create policy dreem_lesson_plans_read on public.dreem_lesson_plans for select to authenticated
using (
  created_by = (select auth.uid())
  or (select private.dreem_has_role(school_id,array['leadership','academic_head','auditor']))
);
grant select on public.dreem_lesson_plans to authenticated;
revoke insert, update, delete on public.dreem_lesson_plans from anon, authenticated;

create function public.dreem_record_lesson_plan(
  p_assignment_id uuid,
  p_lesson_date date,
  p_title text,
  p_objectives text,
  p_learning_activity text,
  p_evidence text,
  p_follow_up text,
  p_idempotency_key text
) returns table(lesson_plan_id uuid, lesson_plan_status text)
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid := (select auth.uid());
  v_assignment public.dreem_teaching_assignments%rowtype;
  v_id uuid;
begin
  if v_actor is null then raise exception 'Authentication is required.'; end if;
  select * into v_assignment from public.dreem_teaching_assignments
  where id=p_assignment_id and status='active';
  if not found then raise exception 'Active teaching assignment is required.'; end if;
  if v_assignment.teacher_user_id <> v_actor
    and not private.dreem_has_role(v_assignment.school_id,array['leadership','academic_head'])
  then raise exception 'Only the assigned teacher or academic leadership can record this lesson plan.'; end if;
  if p_lesson_date is null or length(trim(p_title))=0 or length(trim(p_objectives))<5
    or length(trim(p_learning_activity))<5 or length(trim(p_evidence))<3
  then raise exception 'Lesson title, objectives, activity and evidence are required.'; end if;

  insert into public.dreem_lesson_plans(
    school_id,teaching_assignment_id,lesson_date,title,objectives,learning_activity,evidence,follow_up,created_by,idempotency_key
  ) values (
    v_assignment.school_id,p_assignment_id,p_lesson_date,trim(p_title),trim(p_objectives),trim(p_learning_activity),trim(p_evidence),nullif(trim(p_follow_up),''),v_actor,p_idempotency_key
  ) on conflict(school_id,idempotency_key) do update set updated_at=now()
  returning id,status into v_id,lesson_plan_status;
  perform private.dreem_write_event(v_assignment.school_id,'lesson_plan',v_id,'lesson_plan.submitted',
    concat('lesson-plan:',p_idempotency_key),jsonb_build_object('assignment_id',p_assignment_id,'lesson_date',p_lesson_date,'objectives',p_objectives));
  lesson_plan_id := v_id;
  return next;
end; $$;

revoke all on function public.dreem_record_lesson_plan(uuid,date,text,text,text,text,text,text) from public,anon;
grant execute on function public.dreem_record_lesson_plan(uuid,date,text,text,text,text,text,text) to authenticated;
create index dreem_lesson_plans_scope_idx on public.dreem_lesson_plans(school_id,teaching_assignment_id,lesson_date desc);
create trigger dreem_audit_lesson_plans after insert or update or delete on public.dreem_lesson_plans for each row execute function private.dreem_audit_row();
