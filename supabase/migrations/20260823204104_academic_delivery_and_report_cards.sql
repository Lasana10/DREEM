-- DREEM-ACADEMICS-001: teaching ownership, collision-safe timetables,
-- independent assessment review and evidence-backed report cards.

alter table public.dreem_assessments add column if not exists term_id uuid references public.dreem_terms(id) on delete set null;
alter table public.dreem_assessments add column if not exists teaching_assignment_id uuid;
alter table public.dreem_assessments add column if not exists approved_by uuid references auth.users(id);
alter table public.dreem_assessments add column if not exists approved_at timestamptz;
alter table public.dreem_assessments add column if not exists published_by uuid references auth.users(id);
alter table public.dreem_assessments add column if not exists published_at timestamptz;
alter table public.dreem_assessments drop constraint if exists dreem_assessments_status_check;
alter table public.dreem_assessments add constraint dreem_assessments_status_check
  check(status in ('draft','submitted','approved','rejected','published','cancelled'));

create table public.dreem_teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.dreem_academic_years(id),
  term_id uuid not null references public.dreem_terms(id),
  class_id uuid not null references public.dreem_classes(id),
  subject_id uuid not null references public.dreem_subjects(id),
  teacher_user_id uuid not null references auth.users(id),
  weekly_periods integer not null check(weekly_periods between 1 and 30),
  status text not null default 'active' check(status in ('planned','active','completed','cancelled')),
  idempotency_key text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,idempotency_key),
  unique(term_id,class_id,subject_id)
);

alter table public.dreem_assessments
  add constraint dreem_assessments_teaching_assignment_fk foreign key(teaching_assignment_id)
  references public.dreem_teaching_assignments(id) on delete set null;

create table public.dreem_timetable_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  term_id uuid not null references public.dreem_terms(id),
  teaching_assignment_id uuid not null references public.dreem_teaching_assignments(id),
  class_id uuid not null references public.dreem_classes(id),
  subject_id uuid not null references public.dreem_subjects(id),
  teacher_user_id uuid not null references auth.users(id),
  weekday integer not null check(weekday between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  room text,
  effective_from date not null,
  effective_to date not null,
  status text not null default 'active' check(status in ('planned','active','cancelled')),
  idempotency_key text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(school_id,idempotency_key),
  check(starts_at < ends_at),
  check(effective_from <= effective_to)
);

create table public.dreem_assessment_reviews (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  assessment_id uuid not null references public.dreem_assessments(id) on delete cascade,
  decision text not null check(decision in ('approved','rejected')),
  note text not null check(char_length(trim(note)) between 5 and 4000),
  reviewer_user_id uuid not null references auth.users(id),
  idempotency_key text not null,
  reviewed_at timestamptz not null default now(),
  unique(school_id,idempotency_key)
);

create table public.dreem_report_cards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  term_id uuid not null references public.dreem_terms(id),
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'draft' check(status in ('draft','published','superseded')),
  revision integer not null default 1 check(revision > 0),
  overall_average numeric(6,2),
  evidence_count integer not null default 0,
  teacher_comment text,
  generated_by uuid not null references auth.users(id),
  generated_at timestamptz not null default now(),
  published_by uuid references auth.users(id),
  published_at timestamptz,
  idempotency_key text not null,
  unique(school_id,idempotency_key),
  unique(term_id,student_id,revision),
  check(status <> 'published' or (published_by is not null and published_at is not null))
);

create table public.dreem_report_card_results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  report_card_id uuid not null references public.dreem_report_cards(id) on delete cascade,
  subject_id uuid references public.dreem_subjects(id) on delete set null,
  subject_name text not null,
  average_percent numeric(6,2) not null check(average_percent between 0 and 100),
  assessment_count integer not null check(assessment_count > 0),
  created_at timestamptz not null default now(),
  unique(report_card_id,subject_name)
);

alter table public.dreem_teaching_assignments enable row level security;
alter table public.dreem_timetable_entries enable row level security;
alter table public.dreem_assessment_reviews enable row level security;
alter table public.dreem_report_cards enable row level security;
alter table public.dreem_report_card_results enable row level security;

create index dreem_teaching_assignments_teacher_idx on public.dreem_teaching_assignments(teacher_user_id,term_id,status);
create index dreem_teaching_assignments_school_idx on public.dreem_teaching_assignments(school_id,term_id,class_id);
create index dreem_timetable_teacher_idx on public.dreem_timetable_entries(teacher_user_id,weekday,starts_at,ends_at) where status <> 'cancelled';
create index dreem_timetable_class_idx on public.dreem_timetable_entries(class_id,weekday,starts_at,ends_at) where status <> 'cancelled';
create index dreem_assessment_reviews_assessment_idx on public.dreem_assessment_reviews(assessment_id,reviewed_at desc);
create index dreem_report_cards_student_idx on public.dreem_report_cards(student_id,term_id,status);
create index dreem_report_results_card_idx on public.dreem_report_card_results(report_card_id);
create index dreem_assessments_term_status_idx on public.dreem_assessments(term_id,status,assessment_date);
create index dreem_assessments_assignment_idx on public.dreem_assessments(teaching_assignment_id) where teaching_assignment_id is not null;
create index dreem_assessments_approver_idx on public.dreem_assessments(approved_by) where approved_by is not null;
create index dreem_assessments_publisher_idx on public.dreem_assessments(published_by) where published_by is not null;

create policy dreem_teaching_assignments_read on public.dreem_teaching_assignments for select to authenticated
using ((select private.dreem_has_role(school_id,array['leadership','administrator','academic_head','auditor'])) or teacher_user_id=(select auth.uid()));
create policy dreem_timetable_entries_read on public.dreem_timetable_entries for select to authenticated
using ((select private.dreem_has_role(school_id,array['leadership','administrator','academic_head','auditor'])) or teacher_user_id=(select auth.uid()));
create policy dreem_assessment_reviews_read on public.dreem_assessment_reviews for select to authenticated
using ((select private.dreem_has_role(school_id,array['leadership','academic_head','auditor'])) or reviewer_user_id=(select auth.uid()));
create policy dreem_report_cards_read on public.dreem_report_cards for select to authenticated
using ((select private.dreem_has_role(school_id,array['leadership','administrator','academic_head','teacher','auditor'])) or (status='published' and (select private.dreem_can_view_student(school_id,student_id))));
create policy dreem_report_card_results_read on public.dreem_report_card_results for select to authenticated
using (exists(select 1 from public.dreem_report_cards c where c.id=report_card_id and ((select private.dreem_has_role(c.school_id,array['leadership','administrator','academic_head','teacher','auditor'])) or (c.status='published' and (select private.dreem_can_view_student(c.school_id,c.student_id))))));

revoke all on public.dreem_teaching_assignments,public.dreem_timetable_entries,public.dreem_assessment_reviews,public.dreem_report_cards,public.dreem_report_card_results from anon,authenticated;
grant select on public.dreem_teaching_assignments,public.dreem_timetable_entries,public.dreem_assessment_reviews,public.dreem_report_cards,public.dreem_report_card_results to authenticated;

create or replace function public.dreem_assign_teacher(p_academic_year_id uuid,p_term_id uuid,p_class_id uuid,p_subject_id uuid,p_teacher_user_id uuid,p_weekly_periods integer,p_idempotency_key text)
returns table(assignment_id uuid,assignment_status text)
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid());v_school uuid;v_id uuid;v_status text;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  v_school:=private.dreem_active_school_for_role(array['leadership','academic_head']);
  if v_school is null then raise exception 'Academic leadership authorization is required.';end if;
  if p_weekly_periods not between 1 and 30 then raise exception 'Weekly periods must be between 1 and 30.';end if;
  if not exists(select 1 from public.dreem_academic_years y join public.dreem_terms t on t.academic_year_id=y.id join public.dreem_classes c on c.school_id=y.school_id join public.dreem_subjects s on s.school_id=y.school_id where y.id=p_academic_year_id and t.id=p_term_id and c.id=p_class_id and s.id=p_subject_id and y.school_id=v_school) then raise exception 'Academic configuration does not belong to this school.';end if;
  if not exists(select 1 from public.dreem_school_memberships m where m.school_id=v_school and m.profile_id=p_teacher_user_id and m.status='approved' and m.role in ('teacher','academic_head','principal','school_owner')) then raise exception 'Teacher must have an approved instructional membership.';end if;
  insert into public.dreem_teaching_assignments(school_id,academic_year_id,term_id,class_id,subject_id,teacher_user_id,weekly_periods,status,idempotency_key,created_by)
  values(v_school,p_academic_year_id,p_term_id,p_class_id,p_subject_id,p_teacher_user_id,p_weekly_periods,'active',p_idempotency_key,v_actor)
  on conflict(school_id,idempotency_key) do update set updated_at=now()
  returning id,status into v_id,v_status;
  perform private.dreem_write_event(v_school,'teaching_assignment',v_id,'teaching.assigned',concat('teaching.assigned:',p_idempotency_key),jsonb_build_object('teacher_user_id',p_teacher_user_id,'term_id',p_term_id,'class_id',p_class_id,'subject_id',p_subject_id));
  assignment_id:=v_id;assignment_status:=v_status;return next;
end;$$;

create or replace function public.dreem_schedule_timetable_entry(p_assignment_id uuid,p_weekday integer,p_starts_at time,p_ends_at time,p_room text,p_effective_from date,p_effective_to date,p_idempotency_key text)
returns table(entry_id uuid,entry_status text)
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid());v_assignment public.dreem_teaching_assignments%rowtype;v_id uuid;v_status text;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  select * into v_assignment from public.dreem_teaching_assignments where id=p_assignment_id;
  if not found or not private.dreem_has_role(v_assignment.school_id,array['leadership','academic_head']) then raise exception 'Academic leadership authorization is required.';end if;
  if v_assignment.status not in ('planned','active') then raise exception 'The teaching assignment is not schedulable.';end if;
  if p_weekday not between 1 and 7 or p_starts_at>=p_ends_at or p_effective_from>p_effective_to then raise exception 'The timetable period is invalid.';end if;
  if exists(select 1 from public.dreem_timetable_entries e where e.school_id=v_assignment.school_id and e.term_id=v_assignment.term_id and e.weekday=p_weekday and e.status<>'cancelled' and daterange(e.effective_from,e.effective_to,'[]') && daterange(p_effective_from,p_effective_to,'[]') and e.starts_at<p_ends_at and p_starts_at<e.ends_at and (e.teacher_user_id=v_assignment.teacher_user_id or e.class_id=v_assignment.class_id)) then raise exception 'This period conflicts with the teacher or class timetable.';end if;
  insert into public.dreem_timetable_entries(school_id,term_id,teaching_assignment_id,class_id,subject_id,teacher_user_id,weekday,starts_at,ends_at,room,effective_from,effective_to,status,idempotency_key,created_by)
  values(v_assignment.school_id,v_assignment.term_id,v_assignment.id,v_assignment.class_id,v_assignment.subject_id,v_assignment.teacher_user_id,p_weekday,p_starts_at,p_ends_at,nullif(trim(p_room),''),p_effective_from,p_effective_to,'active',p_idempotency_key,v_actor)
  on conflict(school_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key
  returning id,status into v_id,v_status;
  perform private.dreem_write_event(v_assignment.school_id,'timetable_entry',v_id,'timetable.scheduled',concat('timetable.scheduled:',p_idempotency_key),jsonb_build_object('assignment_id',v_assignment.id,'weekday',p_weekday,'starts_at',p_starts_at));
  entry_id:=v_id;entry_status:=v_status;return next;
end;$$;

create or replace function public.dreem_review_assessment(p_assessment_id uuid,p_decision text,p_note text,p_idempotency_key text)
returns table(assessment_id uuid,assessment_status text)
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid());v_assessment public.dreem_assessments%rowtype;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  select * into v_assessment from public.dreem_assessments where id=p_assessment_id for update;
  if not found or not private.dreem_has_role(v_assessment.school_id,array['leadership','academic_head']) then raise exception 'Independent academic review authorization is required.';end if;
  if v_assessment.created_by=v_actor then raise exception 'Assessment authors cannot approve their own evidence.';end if;
  if v_assessment.status<>'submitted' then raise exception 'Only submitted assessments can be reviewed.';end if;
  if p_decision not in ('approved','rejected') then raise exception 'Review decision must be approved or rejected.';end if;
  if char_length(trim(coalesce(p_note,'')))<5 then raise exception 'A review note is required.';end if;
  if not exists(select 1 from public.dreem_marks m where m.assessment_id=v_assessment.id) then raise exception 'An assessment without marks cannot be approved.';end if;
  insert into public.dreem_assessment_reviews(school_id,assessment_id,decision,note,reviewer_user_id,idempotency_key) values(v_assessment.school_id,v_assessment.id,p_decision,trim(p_note),v_actor,p_idempotency_key);
  update public.dreem_assessments set status=p_decision,approved_by=case when p_decision='approved' then v_actor end,approved_at=case when p_decision='approved' then now() end,updated_at=now() where id=v_assessment.id returning id,status into assessment_id,assessment_status;
  perform private.dreem_write_event(v_assessment.school_id,'assessment',v_assessment.id,concat('assessment.',p_decision),concat('assessment.reviewed:',p_idempotency_key),jsonb_build_object('decision',p_decision,'note',trim(p_note)));
  return next;
end;$$;

create or replace function public.dreem_publish_assessment(p_assessment_id uuid,p_idempotency_key text)
returns table(assessment_id uuid,assessment_status text)
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid());v_assessment public.dreem_assessments%rowtype;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  select * into v_assessment from public.dreem_assessments where id=p_assessment_id for update;
  if not found or not private.dreem_has_role(v_assessment.school_id,array['leadership','academic_head']) then raise exception 'Academic publication authorization is required.';end if;
  if v_assessment.status='published' then assessment_id:=v_assessment.id;assessment_status:=v_assessment.status;return next;return;end if;
  if v_assessment.status<>'approved' then raise exception 'Only independently approved assessments can be published.';end if;
  update public.dreem_assessments set status='published',published_by=v_actor,published_at=now(),updated_at=now() where id=v_assessment.id returning id,status into assessment_id,assessment_status;
  perform private.dreem_write_event(v_assessment.school_id,'assessment',v_assessment.id,'assessment.published',concat('assessment.published:',p_idempotency_key),jsonb_build_object('approved_by',v_assessment.approved_by));
  return next;
end;$$;

create or replace function public.dreem_generate_report_card(p_student_id uuid,p_term_id uuid,p_teacher_comment text,p_idempotency_key text)
returns table(report_card_id uuid,report_status text,evidence_count integer,overall_average numeric)
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid());v_school uuid;v_student public.students%rowtype;v_id uuid;v_revision integer;v_count integer;v_average numeric;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  select * into v_student from public.students where id=p_student_id;
  if not found or not private.dreem_has_role(v_student.school_id,array['leadership','academic_head','teacher']) then raise exception 'Academic reporting authorization is required.';end if;
  v_school:=v_student.school_id;
  if not exists(select 1 from public.dreem_terms t where t.id=p_term_id and t.school_id=v_school) then raise exception 'Term does not belong to this school.';end if;
  select count(*),round(avg(m.score/a.max_score*100),2) into v_count,v_average from public.dreem_marks m join public.dreem_assessments a on a.id=m.assessment_id where m.student_id=p_student_id and a.school_id=v_school and a.term_id=p_term_id and a.status='published';
  if v_count=0 then raise exception 'No published assessment evidence exists for this learner and term.';end if;
  select coalesce(max(revision),0)+1 into v_revision from public.dreem_report_cards where student_id=p_student_id and term_id=p_term_id;
  update public.dreem_report_cards set status='superseded' where student_id=p_student_id and term_id=p_term_id and status='draft';
  insert into public.dreem_report_cards(school_id,term_id,student_id,status,revision,overall_average,evidence_count,teacher_comment,generated_by,idempotency_key) values(v_school,p_term_id,p_student_id,'draft',v_revision,v_average,v_count,nullif(trim(p_teacher_comment),''),v_actor,p_idempotency_key) returning id into v_id;
  insert into public.dreem_report_card_results(school_id,report_card_id,subject_id,subject_name,average_percent,assessment_count)
  select v_school,v_id,a.subject_id,coalesce(s.name,'Unassigned subject'),round(avg(m.score/a.max_score*100),2),count(distinct a.id) from public.dreem_marks m join public.dreem_assessments a on a.id=m.assessment_id left join public.dreem_subjects s on s.id=a.subject_id where m.student_id=p_student_id and a.school_id=v_school and a.term_id=p_term_id and a.status='published' group by a.subject_id,s.name;
  perform private.dreem_write_event(v_school,'report_card',v_id,'report_card.generated',concat('report_card.generated:',p_idempotency_key),jsonb_build_object('student_id',p_student_id,'term_id',p_term_id,'evidence_count',v_count,'revision',v_revision));
  report_card_id:=v_id;report_status:='draft';evidence_count:=v_count;overall_average:=v_average;return next;
end;$$;

create or replace function public.dreem_publish_report_card(p_report_card_id uuid,p_idempotency_key text)
returns table(report_card_id uuid,report_status text)
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid());v_card public.dreem_report_cards%rowtype;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  select * into v_card from public.dreem_report_cards where id=p_report_card_id for update;
  if not found or not private.dreem_has_role(v_card.school_id,array['leadership','academic_head']) then raise exception 'Academic publication authorization is required.';end if;
  if v_card.generated_by=v_actor then raise exception 'Report-card generators cannot publish their own snapshot.';end if;
  if v_card.status='published' then report_card_id:=v_card.id;report_status:=v_card.status;return next;return;end if;
  if v_card.status<>'draft' or v_card.evidence_count<1 then raise exception 'Only an evidenced draft report card can be published.';end if;
  update public.dreem_report_cards set status='superseded' where student_id=v_card.student_id and term_id=v_card.term_id and status='published';
  update public.dreem_report_cards set status='published',published_by=v_actor,published_at=now() where id=v_card.id returning id,status into report_card_id,report_status;
  perform private.dreem_write_event(v_card.school_id,'report_card',v_card.id,'report_card.published',concat('report_card.published:',p_idempotency_key),jsonb_build_object('student_id',v_card.student_id,'term_id',v_card.term_id,'revision',v_card.revision));
  return next;
end;$$;

create or replace function public.dreem_record_assessment(p_subject_id uuid,p_class_name text,p_title text,p_max_score numeric,p_assessment_date date,p_marks jsonb,p_idempotency_key text)
returns table(assessment_id uuid,marks_count integer)
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid());v_school uuid;v_id uuid;v_count integer;v_average numeric;v_term uuid;v_assignment uuid;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  v_school:=private.dreem_active_school_for_role(array['leadership','support','teacher']);
  if v_school is null then raise exception 'You are not authorized to record assessments.';end if;
  if p_max_score is null or p_max_score<=0 then raise exception 'Maximum score must be positive.';end if;
  select t.id into v_term from public.dreem_terms t where t.school_id=v_school and p_assessment_date between t.starts_on and t.ends_on order by t.order_index limit 1;
  select ta.id into v_assignment from public.dreem_teaching_assignments ta join public.dreem_classes c on c.id=ta.class_id where ta.school_id=v_school and ta.term_id=v_term and ta.subject_id=p_subject_id and lower(c.name)=lower(trim(p_class_name)) and ta.teacher_user_id=v_actor and ta.status='active' limit 1;
  insert into public.dreem_assessments(school_id,subject_id,class_name,title,max_score,assessment_date,status,created_by,idempotency_key,term_id,teaching_assignment_id)
  values(v_school,p_subject_id,trim(p_class_name),trim(p_title),p_max_score,p_assessment_date,'submitted',v_actor,p_idempotency_key,v_term,v_assignment)
  on conflict(school_id,idempotency_key) do update set updated_at=now() returning id into v_id;
  insert into public.dreem_marks(school_id,assessment_id,student_id,score,comment,recorded_by)
  select v_school,v_id,(mark->>'student_id')::uuid,(mark->>'score')::numeric,nullif(mark->>'comment',''),v_actor from jsonb_array_elements(p_marks) mark join public.students s on s.id=(mark->>'student_id')::uuid and s.school_id=v_school where (mark->>'score')::numeric between 0 and p_max_score on conflict(assessment_id,student_id) do update set score=excluded.score,comment=excluded.comment;
  select count(*),avg(score/p_max_score*100) into v_count,v_average from public.dreem_marks where assessment_id=v_id;
  if v_count=0 then raise exception 'No valid learner marks were supplied.';end if;
  perform private.dreem_write_event(v_school,'assessment',v_id,'assessment.submitted',concat('assessment.submitted:',p_idempotency_key),jsonb_build_object('class_name',p_class_name,'term_id',v_term,'teaching_assignment_id',v_assignment,'marks_count',v_count,'average',v_average));
  assessment_id:=v_id;marks_count:=v_count;return next;
end;$$;

create trigger dreem_audit_teaching_assignments after insert or update or delete on public.dreem_teaching_assignments for each row execute function private.dreem_audit_row();
create trigger dreem_audit_timetable_entries after insert or update or delete on public.dreem_timetable_entries for each row execute function private.dreem_audit_row();
create trigger dreem_assessment_reviews_immutable before update or delete on public.dreem_assessment_reviews for each row execute function private.dreem_prevent_mutation();
create trigger dreem_report_results_immutable before update or delete on public.dreem_report_card_results for each row execute function private.dreem_prevent_mutation();
create trigger dreem_audit_report_cards after insert or update or delete on public.dreem_report_cards for each row execute function private.dreem_audit_row();

revoke all on function public.dreem_assign_teacher(uuid,uuid,uuid,uuid,uuid,integer,text),public.dreem_schedule_timetable_entry(uuid,integer,time,time,text,date,date,text),public.dreem_review_assessment(uuid,text,text,text),public.dreem_publish_assessment(uuid,text),public.dreem_generate_report_card(uuid,uuid,text,text),public.dreem_publish_report_card(uuid,text) from public,anon,authenticated;
grant execute on function public.dreem_assign_teacher(uuid,uuid,uuid,uuid,uuid,integer,text),public.dreem_schedule_timetable_entry(uuid,integer,time,time,text,date,date,text),public.dreem_review_assessment(uuid,text,text,text),public.dreem_publish_assessment(uuid,text),public.dreem_generate_report_card(uuid,uuid,text,text),public.dreem_publish_report_card(uuid,text) to authenticated;
