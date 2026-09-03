insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('dreem-assignment-submissions','dreem-assignment-submissions',false,20971520,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/png','image/jpeg','image/webp','text/plain'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table public.dreem_assignments(
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  teaching_assignment_id uuid not null references public.dreem_teaching_assignments(id) on delete cascade,
  term_id uuid not null references public.dreem_terms(id) on delete cascade,
  class_id uuid not null references public.dreem_classes(id) on delete cascade,
  subject_id uuid not null references public.dreem_subjects(id) on delete cascade,
  title text not null, instructions text not null, assigned_on date not null, due_at timestamptz not null,
  max_score numeric(8,2) not null check(max_score>0), submission_mode text not null default 'text_or_file' check(submission_mode in('text','file','text_or_file','offline')),
  status text not null default 'draft' check(status in('draft','published','closed','archived')),
  created_by uuid not null references auth.users(id), published_at timestamptz, closed_at timestamptz,
  idempotency_key text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(school_id,idempotency_key)
);
create table public.dreem_assignment_outcomes(
  assignment_id uuid not null references public.dreem_assignments(id) on delete cascade,
  outcome_id uuid not null references public.dreem_curriculum_outcomes(id) on delete restrict,
  primary key(assignment_id,outcome_id)
);
create table public.dreem_assignment_submissions(
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  assignment_id uuid not null references public.dreem_assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  attempt integer not null default 1 check(attempt between 1 and 10), response_text text,
  storage_path text, file_name text, mime_type text, file_size bigint check(file_size is null or file_size between 1 and 20971520),
  status text not null check(status in('submitted','late','needs_revision','graded')),
  submitted_by uuid not null references auth.users(id), submitted_at timestamptz not null default now(),
  score numeric(8,2), feedback text, graded_by uuid references auth.users(id), graded_at timestamptz,
  updated_at timestamptz not null default now(), unique(assignment_id,student_id,attempt),
  check(response_text is not null or storage_path is not null),
  check((status<>'graded') or (score is not null and graded_by is not null and graded_at is not null))
);

alter table public.dreem_assignments enable row level security;
alter table public.dreem_assignment_outcomes enable row level security;
alter table public.dreem_assignment_submissions enable row level security;

create policy dreem_assignments_read on public.dreem_assignments for select to authenticated using(
  (select private.dreem_has_role(school_id,array['leadership','administrator','academic_head','teacher','tutor','auditor']))
  or (status in('published','closed') and exists(select 1 from public.students s join public.dreem_classes c on c.id=dreem_assignments.class_id where s.school_id=dreem_assignments.school_id and lower(s.class_name)=lower(c.name) and (select private.dreem_can_view_student(s.school_id,s.id))))
);
create policy dreem_assignment_outcomes_read on public.dreem_assignment_outcomes for select to authenticated using(
  exists(select 1 from public.dreem_assignments a where a.id=assignment_id)
);
create policy dreem_assignment_submissions_read on public.dreem_assignment_submissions for select to authenticated using(
  (select private.dreem_has_role(school_id,array['leadership','administrator','academic_head','teacher','tutor','auditor']))
  or (select private.dreem_can_view_student(school_id,student_id))
);

revoke all on public.dreem_assignments,public.dreem_assignment_outcomes,public.dreem_assignment_submissions from public,anon,authenticated;
grant select on public.dreem_assignments,public.dreem_assignment_outcomes,public.dreem_assignment_submissions to authenticated;

create policy dreem_assignment_file_insert on storage.objects for insert to authenticated with check(
  bucket_id='dreem-assignment-submissions' and lower(storage.extension(name)) in('pdf','doc','docx','png','jpg','jpeg','webp','txt')
  and exists(select 1 from public.students s where s.id=case when (storage.foldername(name))[2]~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then (storage.foldername(name))[2]::uuid end and s.school_id=case when (storage.foldername(name))[1]~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then (storage.foldername(name))[1]::uuid end and (s.profile_id=(select auth.uid()) or (select auth.uid())=any(coalesce(s.parent_user_ids,array[]::uuid[]))))
);
create policy dreem_assignment_file_select on storage.objects for select to authenticated using(
  bucket_id='dreem-assignment-submissions' and exists(select 1 from public.students s where s.id=case when (storage.foldername(name))[2]~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then (storage.foldername(name))[2]::uuid end and s.school_id=case when (storage.foldername(name))[1]~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then (storage.foldername(name))[1]::uuid end and ((select private.dreem_can_view_student(s.school_id,s.id)) or (select private.dreem_has_role(s.school_id,array['leadership','academic_head','teacher','auditor']))))
);

create function public.dreem_create_assignment(p_teaching_assignment_id uuid,p_title text,p_instructions text,p_assigned_on date,p_due_at timestamptz,p_max_score numeric,p_submission_mode text,p_outcome_ids uuid[],p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_ta public.dreem_teaching_assignments%rowtype;v_id uuid;
begin
 select * into v_ta from public.dreem_teaching_assignments where id=p_teaching_assignment_id and status='active';
 if v_actor is null or not found then raise exception 'Active teaching assignment is required.';end if;
 if v_ta.teacher_user_id<>v_actor and not private.dreem_has_role(v_ta.school_id,array['leadership','academic_head']) then raise exception 'Only the assigned teacher or academic leadership may create work.';end if;
 if length(trim(p_title))<3 or length(trim(p_instructions))<5 or p_due_at<=p_assigned_on::timestamptz or p_max_score<=0 or p_submission_mode not in('text','file','text_or_file','offline') then raise exception 'Complete the assignment title, instructions, dates, score and submission mode.';end if;
 insert into public.dreem_assignments(school_id,teaching_assignment_id,term_id,class_id,subject_id,title,instructions,assigned_on,due_at,max_score,submission_mode,created_by,idempotency_key)
 values(v_ta.school_id,v_ta.id,v_ta.term_id,v_ta.class_id,v_ta.subject_id,trim(p_title),trim(p_instructions),p_assigned_on,p_due_at,p_max_score,p_submission_mode,v_actor,p_idempotency_key)
 on conflict(school_id,idempotency_key) do update set updated_at=now() returning id into v_id;
 insert into public.dreem_assignment_outcomes(assignment_id,outcome_id) select v_id,o.id from public.dreem_curriculum_outcomes o where o.id=any(coalesce(p_outcome_ids,array[]::uuid[])) and o.school_id=v_ta.school_id and o.class_id=v_ta.class_id and o.subject_id=v_ta.subject_id on conflict do nothing;
 perform private.dreem_write_event(v_ta.school_id,'assignment',v_id,'assignment.drafted','assignment.drafted:'||p_idempotency_key,jsonb_build_object('due_at',p_due_at,'max_score',p_max_score));return v_id;
end;$$;

create function public.dreem_publish_assignment(p_assignment_id uuid,p_idempotency_key text)
returns text language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_a public.dreem_assignments%rowtype;
begin
 select * into v_a from public.dreem_assignments where id=p_assignment_id for update;
 if v_actor is null or not found then raise exception 'Assignment was not found.';end if;
 if v_a.created_by<>v_actor and not private.dreem_has_role(v_a.school_id,array['leadership','academic_head']) then raise exception 'Assignment publication permission is required.';end if;
 if v_a.status='published' then return v_a.status;end if;
 if v_a.status<>'draft' then raise exception 'Only a draft assignment can be published.';end if;
 update public.dreem_assignments set status='published',published_at=now(),updated_at=now() where id=v_a.id;
 perform private.dreem_write_event(v_a.school_id,'assignment',v_a.id,'assignment.published','assignment.published:'||p_idempotency_key,jsonb_build_object('due_at',v_a.due_at));return 'published';
end;$$;

create function public.dreem_submit_assignment(p_assignment_id uuid,p_student_id uuid,p_response_text text,p_storage_path text,p_file_name text,p_mime_type text,p_file_size bigint)
returns table(submission_id uuid,submission_status text,attempt_number integer) language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_a public.dreem_assignments%rowtype;v_s public.students%rowtype;v_id uuid;v_attempt integer;v_status text;
begin
 select * into v_a from public.dreem_assignments where id=p_assignment_id and status='published';select * into v_s from public.students where id=p_student_id;
 if v_actor is null or v_a.id is null or v_s.id is null or v_s.school_id<>v_a.school_id then raise exception 'Published assignment and learner are required.';end if;
 if not(v_s.profile_id=v_actor or v_actor=any(coalesce(v_s.parent_user_ids,array[]::uuid[])) or private.dreem_has_role(v_a.school_id,array['leadership','administrator'])) then raise exception 'This account cannot submit for the learner.';end if;
 if not exists(select 1 from public.dreem_classes c where c.id=v_a.class_id and lower(c.name)=lower(v_s.class_name)) then raise exception 'The learner is not enrolled in the assigned class.';end if;
 if nullif(trim(p_response_text),'') is null and nullif(trim(p_storage_path),'') is null then raise exception 'Enter a response or upload evidence.';end if;
 if p_storage_path is not null and (split_part(p_storage_path,'/',1)<>v_a.school_id::text or split_part(p_storage_path,'/',2)<>p_student_id::text) then raise exception 'Invalid submission file path.';end if;
 select coalesce(max(attempt),0)+1 into v_attempt from public.dreem_assignment_submissions where assignment_id=v_a.id and student_id=p_student_id;
 v_status:=case when now()>v_a.due_at then 'late' else 'submitted' end;
 insert into public.dreem_assignment_submissions(school_id,assignment_id,student_id,attempt,response_text,storage_path,file_name,mime_type,file_size,status,submitted_by)
 values(v_a.school_id,v_a.id,p_student_id,v_attempt,nullif(trim(p_response_text),''),nullif(trim(p_storage_path),''),p_file_name,p_mime_type,p_file_size,v_status,v_actor) returning id into v_id;
 perform private.dreem_write_event(v_a.school_id,'assignment_submission',v_id,'assignment.'||v_status,'assignment-submission:'||v_id::text,jsonb_build_object('assignment_id',v_a.id,'student_id',p_student_id,'attempt',v_attempt));
 submission_id:=v_id;submission_status:=v_status;attempt_number:=v_attempt;return next;
end;$$;

create function public.dreem_grade_assignment_submission(p_submission_id uuid,p_score numeric,p_feedback text,p_decision text,p_idempotency_key text)
returns text language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_s public.dreem_assignment_submissions%rowtype;v_a public.dreem_assignments%rowtype;v_ta public.dreem_teaching_assignments%rowtype;v_status text;
begin
 select * into v_s from public.dreem_assignment_submissions where id=p_submission_id for update;select * into v_a from public.dreem_assignments where id=v_s.assignment_id;select * into v_ta from public.dreem_teaching_assignments where id=v_a.teaching_assignment_id;
 if v_actor is null or v_s.id is null then raise exception 'Submission was not found.';end if;
 if v_ta.teacher_user_id<>v_actor and not private.dreem_has_role(v_s.school_id,array['leadership','academic_head']) then raise exception 'Only the assigned teacher or academic leadership may grade this work.';end if;
 if p_decision not in('graded','needs_revision') or length(trim(p_feedback))<3 then raise exception 'Grade decision and feedback are required.';end if;
 if p_decision='graded' and (p_score is null or p_score<0 or p_score>v_a.max_score) then raise exception 'Score must be within the assignment maximum.';end if;
 v_status:=p_decision;update public.dreem_assignment_submissions set status=v_status,score=case when v_status='graded' then p_score else null end,feedback=trim(p_feedback),graded_by=v_actor,graded_at=now(),updated_at=now() where id=v_s.id;
 perform private.dreem_write_event(v_s.school_id,'assignment_submission',v_s.id,'assignment_submission.'||v_status,'assignment-grade:'||p_idempotency_key,jsonb_build_object('score',p_score,'feedback',trim(p_feedback)));return v_status;
end;$$;

revoke all on function public.dreem_create_assignment(uuid,text,text,date,timestamptz,numeric,text,uuid[],text),public.dreem_publish_assignment(uuid,text),public.dreem_submit_assignment(uuid,uuid,text,text,text,text,bigint),public.dreem_grade_assignment_submission(uuid,numeric,text,text,text) from public,anon;
grant execute on function public.dreem_create_assignment(uuid,text,text,date,timestamptz,numeric,text,uuid[],text),public.dreem_publish_assignment(uuid,text),public.dreem_submit_assignment(uuid,uuid,text,text,text,text,bigint),public.dreem_grade_assignment_submission(uuid,numeric,text,text,text) to authenticated;
create index dreem_assignments_scope_idx on public.dreem_assignments(school_id,class_id,subject_id,status,due_at);
create index dreem_assignment_submissions_scope_idx on public.dreem_assignment_submissions(school_id,assignment_id,student_id,status);
create trigger dreem_audit_assignments after insert or update or delete on public.dreem_assignments for each row execute function private.dreem_audit_row();
create trigger dreem_audit_assignment_submissions after insert or update or delete on public.dreem_assignment_submissions for each row execute function private.dreem_audit_row();
