-- DREEM-CARE-001: confidential learner support, safeguarding and case workflow.
-- Cases are mutated only through controlled commands. The event stream is immutable.

create table if not exists public.dreem_student_cases (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  case_number text not null,
  category text not null check (category in (
    'learning_support','attendance','wellbeing','safeguarding','discipline',
    'health','financial_support','other'
  )),
  priority text not null default 'normal' check (priority in ('normal','important','urgent','critical')),
  confidentiality text not null default 'standard' check (confidentiality in ('standard','restricted')),
  status text not null default 'open' check (status in ('open','triaged','assigned','in_progress','resolved','closed')),
  title text not null check (char_length(trim(title)) between 3 and 160),
  summary text not null check (char_length(trim(summary)) between 10 and 4000),
  opened_by uuid not null references auth.users(id),
  assigned_to uuid references auth.users(id),
  review_due_on date,
  closure_outcome text,
  idempotency_key text not null,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (school_id, case_number),
  unique (school_id, idempotency_key),
  check (category <> 'safeguarding' or confidentiality = 'restricted'),
  check (status not in ('resolved','closed') or nullif(trim(closure_outcome),'') is not null)
);

create table if not exists public.dreem_case_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  case_id uuid not null references public.dreem_student_cases(id) on delete cascade,
  event_type text not null check (event_type in ('opened','triaged','assigned','note_added','started','resolved','closed','reopened')),
  from_status text,
  to_status text,
  note text check (note is null or char_length(trim(note)) between 2 and 4000),
  actor_user_id uuid not null references auth.users(id),
  occurred_at timestamptz not null default now()
);

alter table public.dreem_student_cases enable row level security;
alter table public.dreem_case_events enable row level security;

create index if not exists dreem_student_cases_school_status_idx
  on public.dreem_student_cases(school_id,status,priority,review_due_on);
create index if not exists dreem_student_cases_student_idx
  on public.dreem_student_cases(student_id,opened_at desc);
create index if not exists dreem_student_cases_assignee_idx
  on public.dreem_student_cases(assigned_to,status)
  where assigned_to is not null and status not in ('resolved','closed');
create index if not exists dreem_case_events_case_idx
  on public.dreem_case_events(case_id,occurred_at);

drop policy if exists dreem_student_cases_read on public.dreem_student_cases;
create policy dreem_student_cases_read
on public.dreem_student_cases
for select
to authenticated
using (
  (select private.dreem_has_role(school_id,array['leadership']))
  or (
    confidentiality = 'standard'
    and (
      (select private.dreem_has_role(school_id,array['administrator','academic_head']))
      or opened_by = (select auth.uid())
      or assigned_to = (select auth.uid())
    )
  )
);

drop policy if exists dreem_case_events_read on public.dreem_case_events;
create policy dreem_case_events_read
on public.dreem_case_events
for select
to authenticated
using (
  exists (
    select 1
      from public.dreem_student_cases c
     where c.id = case_id
       and c.school_id = school_id
  )
);

revoke all on public.dreem_student_cases, public.dreem_case_events from anon, authenticated;
grant select on public.dreem_student_cases, public.dreem_case_events to authenticated;

create or replace function public.dreem_open_student_case(
  p_student_id uuid,
  p_category text,
  p_priority text,
  p_title text,
  p_summary text,
  p_review_due_on date,
  p_assigned_to uuid,
  p_idempotency_key text
) returns table(case_id uuid, case_number text, case_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_school_id uuid;
  v_case_id uuid;
  v_case_number text;
  v_confidentiality text;
  v_existing public.dreem_student_cases%rowtype;
begin
  if v_actor is null then raise exception 'Authentication is required.'; end if;
  if p_category not in ('learning_support','attendance','wellbeing','safeguarding','discipline','health','financial_support','other') then
    raise exception 'Unsupported case category.';
  end if;
  if p_priority not in ('normal','important','urgent','critical') then raise exception 'Unsupported case priority.'; end if;
  if nullif(trim(p_title),'') is null or char_length(trim(p_title)) < 3 then raise exception 'A case title is required.'; end if;
  if nullif(trim(p_summary),'') is null or char_length(trim(p_summary)) < 10 then raise exception 'A meaningful case summary is required.'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'An idempotency key is required.'; end if;

  select s.school_id into v_school_id
    from public.students s
   where s.id = p_student_id
     and private.dreem_has_role(s.school_id,array['leadership','administrator','academic_head','teacher','tutor']);
  if v_school_id is null then raise exception 'You are not authorized to open a case for this learner.'; end if;

  select * into v_existing
    from public.dreem_student_cases c
   where c.school_id = v_school_id and c.idempotency_key = p_idempotency_key;
  if found then
    case_id := v_existing.id;
    case_number := v_existing.case_number;
    case_status := v_existing.status;
    return next;
    return;
  end if;

  if p_assigned_to is not null and not exists (
    select 1 from public.dreem_school_memberships m
     where m.school_id = v_school_id and m.profile_id = p_assigned_to and m.status = 'approved'
  ) then raise exception 'The case assignee is not an approved member of this school.'; end if;

  v_confidentiality := case when p_category in ('safeguarding','health') then 'restricted' else 'standard' end;
  v_case_number := concat('DCS-',to_char(now(),'YY'),'-',upper(substr(replace(gen_random_uuid()::text,'-',''),1,7)));

  insert into public.dreem_student_cases(
    school_id,student_id,case_number,category,priority,confidentiality,title,summary,
    opened_by,assigned_to,review_due_on,idempotency_key,status
  ) values (
    v_school_id,p_student_id,v_case_number,p_category,p_priority,v_confidentiality,
    trim(p_title),trim(p_summary),v_actor,p_assigned_to,p_review_due_on,p_idempotency_key,
    case when p_assigned_to is null then 'open' else 'assigned' end
  ) returning id,status into v_case_id,case_status;

  insert into public.dreem_case_events(school_id,case_id,event_type,to_status,note,actor_user_id)
  values (v_school_id,v_case_id,'opened',case_status,trim(p_summary),v_actor);

  perform private.dreem_write_event(
    v_school_id,'student_case',v_case_id,'case.opened',concat('case.opened:',p_idempotency_key),
    jsonb_build_object('student_id',p_student_id,'category',p_category,'priority',p_priority,'status',case_status)
  );

  case_id := v_case_id;
  case_number := v_case_number;
  return next;
end;
$$;

create or replace function public.dreem_progress_student_case(
  p_case_id uuid,
  p_target_status text,
  p_note text,
  p_assigned_to uuid,
  p_review_due_on date,
  p_idempotency_key text
) returns table(case_id uuid, case_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_case public.dreem_student_cases%rowtype;
  v_event_type text;
begin
  if v_actor is null then raise exception 'Authentication is required.'; end if;
  if p_target_status not in ('open','triaged','assigned','in_progress','resolved','closed') then raise exception 'Unsupported case status.'; end if;
  if nullif(trim(p_note),'') is null then raise exception 'A case note is required.'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'An idempotency key is required.'; end if;

  select * into v_case from public.dreem_student_cases where id = p_case_id for update;
  if not found then raise exception 'Case not found.'; end if;
  if not (
    private.dreem_has_role(v_case.school_id,array['leadership','administrator','academic_head'])
    or (v_case.confidentiality = 'standard' and v_actor in (v_case.opened_by,v_case.assigned_to))
  ) then raise exception 'You are not authorized to progress this case.'; end if;
  if v_case.status = 'closed' and p_target_status <> 'open' then raise exception 'A closed case must be reopened before any other action.'; end if;
  if p_target_status in ('resolved','closed') and char_length(trim(p_note)) < 10 then raise exception 'Resolution notes must explain the outcome.'; end if;

  if p_assigned_to is not null and not exists (
    select 1 from public.dreem_school_memberships m
     where m.school_id = v_case.school_id and m.profile_id = p_assigned_to and m.status = 'approved'
  ) then raise exception 'The case assignee is not an approved member of this school.'; end if;

  if exists (
    select 1 from public.dreem_domain_events e
     where e.school_id = v_case.school_id and e.idempotency_key = concat('case.progressed:',p_idempotency_key)
  ) then
    case_id := v_case.id;
    case_status := v_case.status;
    return next;
    return;
  end if;

  v_event_type := case
    when v_case.status = 'closed' and p_target_status = 'open' then 'reopened'
    when p_target_status = 'triaged' then 'triaged'
    when p_target_status = 'assigned' then 'assigned'
    when p_target_status = 'in_progress' then 'started'
    when p_target_status = 'resolved' then 'resolved'
    when p_target_status = 'closed' then 'closed'
    else 'note_added'
  end;

  update public.dreem_student_cases
     set status = p_target_status,
         assigned_to = coalesce(p_assigned_to,assigned_to),
         review_due_on = coalesce(p_review_due_on,review_due_on),
         closure_outcome = case when p_target_status in ('resolved','closed') then trim(p_note) else closure_outcome end,
         resolved_at = case when p_target_status = 'resolved' then now() when p_target_status = 'open' then null else resolved_at end,
         closed_at = case when p_target_status = 'closed' then now() when p_target_status = 'open' then null else closed_at end,
         updated_at = now()
   where id = v_case.id
   returning id,status into case_id,case_status;

  insert into public.dreem_case_events(school_id,case_id,event_type,from_status,to_status,note,actor_user_id)
  values (v_case.school_id,v_case.id,v_event_type,v_case.status,p_target_status,trim(p_note),v_actor);

  perform private.dreem_write_event(
    v_case.school_id,'student_case',v_case.id,'case.progressed',concat('case.progressed:',p_idempotency_key),
    jsonb_build_object('from_status',v_case.status,'to_status',p_target_status,'assigned_to',p_assigned_to)
  );
  return next;
end;
$$;

drop trigger if exists dreem_case_events_immutable on public.dreem_case_events;
create trigger dreem_case_events_immutable
before update or delete on public.dreem_case_events
for each row execute function private.dreem_prevent_mutation();

drop trigger if exists dreem_audit_student_cases on public.dreem_student_cases;
create trigger dreem_audit_student_cases
after insert or update or delete on public.dreem_student_cases
for each row execute function private.dreem_audit_row();

revoke all on function public.dreem_open_student_case(uuid,text,text,text,text,date,uuid,text) from public, anon, authenticated;
revoke all on function public.dreem_progress_student_case(uuid,text,text,uuid,date,text) from public, anon, authenticated;
grant execute on function public.dreem_open_student_case(uuid,text,text,text,text,date,uuid,text) to authenticated;
grant execute on function public.dreem_progress_student_case(uuid,text,text,uuid,date,text) to authenticated;
