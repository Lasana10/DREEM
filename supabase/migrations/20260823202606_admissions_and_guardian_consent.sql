-- DREEM-ADMISSIONS-001: application, review, consent and enrolment lifecycle.

create table if not exists public.dreem_admission_applications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  application_number text not null,
  learner_full_name text not null check (char_length(trim(learner_full_name)) between 3 and 180),
  date_of_birth date,
  sex text check (sex is null or sex in ('female','male','other')),
  target_class_name text not null,
  previous_school text,
  support_notes text,
  guardian_full_name text not null,
  guardian_phone text,
  guardian_email text,
  guardian_relationship text not null default 'guardian',
  source text not null default 'school_desk' check (source in ('school_desk','referral','website','campaign','transfer','other')),
  status text not null default 'submitted' check (status in ('submitted','under_review','documents_pending','interview','offered','accepted','waitlisted','rejected','withdrawn','enrolled')),
  assigned_to uuid references auth.users(id),
  submitted_by uuid not null references auth.users(id),
  enrolled_student_id uuid references public.students(id),
  idempotency_key text not null,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (school_id,application_number),
  unique (school_id,idempotency_key),
  check (status <> 'enrolled' or enrolled_student_id is not null)
);

create table if not exists public.dreem_admission_consents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  application_id uuid not null references public.dreem_admission_applications(id) on delete cascade,
  consent_type text not null check (consent_type in ('information_accuracy','data_processing','communications','medical_support','media','transport')),
  granted boolean not null,
  subject_name text not null,
  evidence jsonb not null default '{}'::jsonb,
  captured_by uuid not null references auth.users(id),
  captured_at timestamptz not null default now()
);

create table if not exists public.dreem_admission_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  application_id uuid not null references public.dreem_admission_applications(id) on delete cascade,
  event_type text not null check (event_type in ('submitted','review_started','documents_requested','interview_scheduled','offered','accepted','waitlisted','rejected','withdrawn','enrolled','note_added')),
  from_status text,
  to_status text,
  note text not null check (char_length(trim(note)) between 2 and 4000),
  actor_user_id uuid not null references auth.users(id),
  occurred_at timestamptz not null default now()
);

alter table public.dreem_admission_applications enable row level security;
alter table public.dreem_admission_consents enable row level security;
alter table public.dreem_admission_events enable row level security;

create index if not exists dreem_admissions_school_status_idx on public.dreem_admission_applications(school_id,status,submitted_at desc);
create index if not exists dreem_admissions_assignee_idx on public.dreem_admission_applications(assigned_to,status) where assigned_to is not null;
create index if not exists dreem_admissions_submitter_idx on public.dreem_admission_applications(submitted_by);
create index if not exists dreem_admissions_enrolled_student_idx on public.dreem_admission_applications(enrolled_student_id) where enrolled_student_id is not null;
create index if not exists dreem_admission_consents_application_idx on public.dreem_admission_consents(application_id,captured_at);
create index if not exists dreem_admission_consents_school_idx on public.dreem_admission_consents(school_id);
create index if not exists dreem_admission_consents_actor_idx on public.dreem_admission_consents(captured_by);
create index if not exists dreem_admission_events_application_idx on public.dreem_admission_events(application_id,occurred_at);
create index if not exists dreem_admission_events_school_idx on public.dreem_admission_events(school_id);
create index if not exists dreem_admission_events_actor_idx on public.dreem_admission_events(actor_user_id);

create policy dreem_admission_applications_read on public.dreem_admission_applications for select to authenticated
using ((select private.dreem_has_role(school_id,array['leadership','administrator','academic_head'])));
create policy dreem_admission_consents_read on public.dreem_admission_consents for select to authenticated
using ((select private.dreem_has_role(school_id,array['leadership','administrator','academic_head'])));
create policy dreem_admission_events_read on public.dreem_admission_events for select to authenticated
using ((select private.dreem_has_role(school_id,array['leadership','administrator','academic_head'])));

revoke all on public.dreem_admission_applications,public.dreem_admission_consents,public.dreem_admission_events from anon,authenticated;
grant select on public.dreem_admission_applications,public.dreem_admission_consents,public.dreem_admission_events to authenticated;

create or replace function public.dreem_record_admission_application(
  p_learner_full_name text,p_date_of_birth date,p_sex text,p_target_class_name text,p_previous_school text,p_support_notes text,
  p_guardian_full_name text,p_guardian_phone text,p_guardian_email text,p_guardian_relationship text,p_source text,
  p_assigned_to uuid,p_consent_accuracy boolean,p_consent_data_processing boolean,p_idempotency_key text
) returns table(application_id uuid,application_number text,application_status text)
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid()); v_school_id uuid; v_id uuid; v_number text; v_existing public.dreem_admission_applications%rowtype;
begin
  if v_actor is null then raise exception 'Authentication is required.'; end if;
  v_school_id:=private.dreem_active_school_for_role(array['leadership','administrator','academic_head']);
  if v_school_id is null then raise exception 'You are not authorized to record admissions.'; end if;
  if char_length(trim(coalesce(p_learner_full_name,'')))<3 then raise exception 'Learner name is required.'; end if;
  if nullif(trim(p_target_class_name),'') is null then raise exception 'Target class is required.'; end if;
  if char_length(trim(coalesce(p_guardian_full_name,'')))<3 then raise exception 'Guardian name is required.'; end if;
  if p_sex is not null and p_sex not in ('female','male','other') then raise exception 'Unsupported sex value.'; end if;
  if p_source not in ('school_desk','referral','website','campaign','transfer','other') then raise exception 'Unsupported application source.'; end if;
  if not coalesce(p_consent_accuracy,false) or not coalesce(p_consent_data_processing,false) then raise exception 'Required guardian declarations must be captured.'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'An idempotency key is required.'; end if;
  select * into v_existing from public.dreem_admission_applications where school_id=v_school_id and idempotency_key=p_idempotency_key;
  if found then application_id:=v_existing.id;application_number:=v_existing.application_number;application_status:=v_existing.status;return next;return;end if;
  if p_assigned_to is not null and not exists(select 1 from public.dreem_school_memberships m where m.school_id=v_school_id and m.profile_id=p_assigned_to and m.status='approved') then raise exception 'Assignee is not an approved school member.';end if;
  v_number:=concat('ADM-',to_char(now(),'YY'),'-',upper(substr(replace(gen_random_uuid()::text,'-',''),1,7)));
  insert into public.dreem_admission_applications(school_id,application_number,learner_full_name,date_of_birth,sex,target_class_name,previous_school,support_notes,guardian_full_name,guardian_phone,guardian_email,guardian_relationship,source,assigned_to,submitted_by,idempotency_key)
  values(v_school_id,v_number,trim(p_learner_full_name),p_date_of_birth,p_sex,trim(p_target_class_name),nullif(trim(p_previous_school),''),nullif(trim(p_support_notes),''),trim(p_guardian_full_name),nullif(trim(p_guardian_phone),''),nullif(lower(trim(p_guardian_email)),''),coalesce(nullif(trim(p_guardian_relationship),''),'guardian'),p_source,p_assigned_to,v_actor,p_idempotency_key)
  returning id,status into v_id,application_status;
  insert into public.dreem_admission_consents(school_id,application_id,consent_type,granted,subject_name,evidence,captured_by)
  values(v_school_id,v_id,'information_accuracy',true,trim(p_guardian_full_name),jsonb_build_object('channel','school_desk'),v_actor),(v_school_id,v_id,'data_processing',true,trim(p_guardian_full_name),jsonb_build_object('channel','school_desk'),v_actor);
  insert into public.dreem_admission_events(school_id,application_id,event_type,to_status,note,actor_user_id)
  values(v_school_id,v_id,'submitted','submitted','Application and required declarations recorded.',v_actor);
  perform private.dreem_write_event(v_school_id,'admission_application',v_id,'admission.submitted',concat('admission.submitted:',p_idempotency_key),jsonb_build_object('application_number',v_number,'target_class',p_target_class_name));
  application_id:=v_id;application_number:=v_number;return next;
end;$$;

create or replace function public.dreem_progress_admission_application(
  p_application_id uuid,p_target_status text,p_note text,p_assigned_to uuid,p_opening_balance numeric,p_idempotency_key text
) returns table(application_id uuid,application_status text,enrolled_student_id uuid,matricule text)
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid()); v_app public.dreem_admission_applications%rowtype; v_event text; v_student uuid; v_guardian uuid; v_matricule text; v_prefix text;
begin
  if v_actor is null then raise exception 'Authentication is required.';end if;
  if p_target_status not in ('under_review','documents_pending','interview','offered','accepted','waitlisted','rejected','withdrawn','enrolled') then raise exception 'Unsupported admission status.';end if;
  if char_length(trim(coalesce(p_note,'')))<2 then raise exception 'A decision or action note is required.';end if;
  if coalesce(p_opening_balance,0)<0 then raise exception 'Opening balance cannot be negative.';end if;
  select * into v_app from public.dreem_admission_applications where id=p_application_id for update;
  if not found or not private.dreem_has_role(v_app.school_id,array['leadership','administrator','academic_head']) then raise exception 'You are not authorized to progress this application.';end if;
  if v_app.status in ('rejected','withdrawn','enrolled') then raise exception 'This application is already in a terminal state.';end if;
  if p_target_status='enrolled' and v_app.status<>'accepted' then raise exception 'An application must be accepted before enrolment.';end if;
  if exists(select 1 from public.dreem_domain_events e where e.school_id=v_app.school_id and e.idempotency_key=concat('admission.progressed:',p_idempotency_key)) then application_id:=v_app.id;application_status:=v_app.status;enrolled_student_id:=v_app.enrolled_student_id;select s.matricule into matricule from public.students s where s.id=v_app.enrolled_student_id;return next;return;end if;
  if p_assigned_to is not null and not exists(select 1 from public.dreem_school_memberships m where m.school_id=v_app.school_id and m.profile_id=p_assigned_to and m.status='approved') then raise exception 'Assignee is not an approved school member.';end if;
  if p_target_status='enrolled' then
    select coalesce(student_id_prefix,'DRM') into v_prefix from public.dreem_school_brands where school_id=v_app.school_id;
    v_matricule:=concat(coalesce(v_prefix,'DRM'),'-',to_char(now(),'YY'),'-',upper(substr(replace(gen_random_uuid()::text,'-',''),1,5)));
    insert into public.students(school_id,matricule,full_name,class_name,date_of_birth,sex,guardian_contact)
    values(v_app.school_id,v_matricule,v_app.learner_full_name,v_app.target_class_name,v_app.date_of_birth,v_app.sex,v_app.guardian_phone) returning id into v_student;
    insert into public.dreem_guardians(school_id,full_name,phone,email) values(v_app.school_id,v_app.guardian_full_name,v_app.guardian_phone,v_app.guardian_email) returning id into v_guardian;
    insert into public.dreem_student_guardians(school_id,student_id,guardian_id,relationship,is_primary) values(v_app.school_id,v_student,v_guardian,v_app.guardian_relationship,true);
    insert into public.fee_accounts(school_id,student_id,amount_due,balance_due,status) values(v_app.school_id,v_student,coalesce(p_opening_balance,0),coalesce(p_opening_balance,0),'open');
  end if;
  v_event:=case p_target_status when 'under_review' then 'review_started' when 'documents_pending' then 'documents_requested' when 'interview' then 'interview_scheduled' else p_target_status end;
  update public.dreem_admission_applications set status=p_target_status,assigned_to=coalesce(p_assigned_to,assigned_to),enrolled_student_id=coalesce(v_student,enrolled_student_id),decided_at=case when p_target_status in ('offered','accepted','waitlisted','rejected','withdrawn','enrolled') then now() else decided_at end,updated_at=now() where id=v_app.id
  returning id,status,dreem_admission_applications.enrolled_student_id into application_id,application_status,enrolled_student_id;
  insert into public.dreem_admission_events(school_id,application_id,event_type,from_status,to_status,note,actor_user_id) values(v_app.school_id,v_app.id,v_event,v_app.status,p_target_status,trim(p_note),v_actor);
  perform private.dreem_write_event(v_app.school_id,'admission_application',v_app.id,'admission.progressed',concat('admission.progressed:',p_idempotency_key),jsonb_build_object('from_status',v_app.status,'to_status',p_target_status,'student_id',v_student));
  matricule:=v_matricule;return next;
end;$$;

create trigger dreem_admission_consents_immutable before update or delete on public.dreem_admission_consents for each row execute function private.dreem_prevent_mutation();
create trigger dreem_admission_events_immutable before update or delete on public.dreem_admission_events for each row execute function private.dreem_prevent_mutation();
create trigger dreem_audit_admission_applications after insert or update or delete on public.dreem_admission_applications for each row execute function private.dreem_audit_row();

revoke all on function public.dreem_record_admission_application(text,date,text,text,text,text,text,text,text,text,text,uuid,boolean,boolean,text) from public,anon,authenticated;
revoke all on function public.dreem_progress_admission_application(uuid,text,text,uuid,numeric,text) from public,anon,authenticated;
grant execute on function public.dreem_record_admission_application(text,date,text,text,text,text,text,text,text,text,text,uuid,boolean,boolean,text) to authenticated;
grant execute on function public.dreem_progress_admission_application(uuid,text,text,uuid,numeric,text) to authenticated;
