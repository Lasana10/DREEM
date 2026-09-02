insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('dreem-academic-documents','dreem-academic-documents',false,15728640,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table public.dreem_academic_documents(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,
 academic_year_id uuid references public.dreem_academic_years(id),term_id uuid references public.dreem_terms(id),class_id uuid references public.dreem_classes(id),subject_id uuid references public.dreem_subjects(id),assessment_id uuid references public.dreem_assessments(id) on delete cascade,
 document_type text not null check(document_type in('syllabus','assessment_paper','marking_guide','past_paper','lesson_resource','learner_evidence')),
 title text not null,language text not null default 'bilingual' check(language in('english','french','bilingual','other')),
 storage_path text not null,file_name text not null,mime_type text not null,file_size bigint not null check(file_size between 1 and 15728640),
 status text not null default 'submitted' check(status in('draft','submitted','approved','rejected','archived')),version integer not null default 1 check(version>0),
 uploaded_by uuid not null references auth.users(id),approved_by uuid references auth.users(id),approved_at timestamptz,created_at timestamptz not null default now(),unique(school_id,storage_path));

alter table public.dreem_assessments add column assessment_type text not null default 'test' check(assessment_type in('quiz','assignment','test','exam','mock','practical','project','oral','observation'));
alter table public.dreem_assessments add column paper_reference text,add column question_summary text,add column marking_guide text,add column syllabus_objectives text,add column duration_minutes integer check(duration_minutes is null or duration_minutes between 1 and 600);
alter table public.dreem_academic_documents enable row level security;
create policy dreem_academic_documents_read on public.dreem_academic_documents for select to authenticated using((select private.dreem_has_role(school_id,array['leadership','academic_head','teacher','auditor'])));
grant select on public.dreem_academic_documents to authenticated;
revoke insert,update,delete on public.dreem_academic_documents from anon,authenticated;

create policy dreem_academic_document_insert on storage.objects for insert to authenticated with check(bucket_id='dreem-academic-documents' and (storage.foldername(name))[1] in(select m.school_id::text from public.dreem_school_memberships m where m.profile_id=(select auth.uid()) and m.status='approved' and m.role in('platform_founder','school_owner','principal','administrator','academic_head','teacher')) and lower(storage.extension(name)) in('pdf','doc','docx','png','jpg','jpeg','webp'));
create policy dreem_academic_document_select on storage.objects for select to authenticated using(bucket_id='dreem-academic-documents' and (storage.foldername(name))[1] in(select m.school_id::text from public.dreem_school_memberships m where m.profile_id=(select auth.uid()) and m.status='approved' and m.role in('platform_founder','school_owner','principal','administrator','academic_head','teacher','auditor')));

create function public.dreem_register_academic_document(p_document_type text,p_title text,p_language text,p_storage_path text,p_file_name text,p_mime_type text,p_file_size bigint,p_academic_year_id uuid default null,p_term_id uuid default null,p_class_id uuid default null,p_subject_id uuid default null,p_assessment_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_school uuid;v_id uuid;
begin
 if v_actor is null then raise exception 'Authentication is required.';end if;
 v_school:=private.dreem_active_school_for_role(array['leadership','support','teacher']);
 if v_school is null then raise exception 'Academic document authorization is required.';end if;
 if p_document_type not in('syllabus','assessment_paper','marking_guide','past_paper','lesson_resource','learner_evidence') or p_language not in('english','french','bilingual','other') then raise exception 'Unsupported academic document metadata.';end if;
 if split_part(p_storage_path,'/',1)<>v_school::text or p_file_size not between 1 and 15728640 then raise exception 'Invalid academic document path or size.';end if;
 insert into public.dreem_academic_documents(school_id,academic_year_id,term_id,class_id,subject_id,assessment_id,document_type,title,language,storage_path,file_name,mime_type,file_size,uploaded_by)
 values(v_school,p_academic_year_id,p_term_id,p_class_id,p_subject_id,p_assessment_id,p_document_type,trim(p_title),p_language,p_storage_path,p_file_name,p_mime_type,p_file_size,v_actor) returning id into v_id;
 perform private.dreem_write_event(v_school,'academic_document',v_id,'academic_document.registered','academic-document:'||v_id::text,jsonb_build_object('type',p_document_type,'subject_id',p_subject_id,'assessment_id',p_assessment_id));return v_id;
end;$$;

create function public.dreem_record_assessment_v2(p_subject_id uuid,p_class_name text,p_title text,p_assessment_type text,p_max_score numeric,p_assessment_date date,p_duration_minutes integer,p_paper_reference text,p_question_summary text,p_marking_guide text,p_syllabus_objectives text,p_marks jsonb,p_idempotency_key text)
returns table(assessment_id uuid,marks_count integer) language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_school uuid;v_id uuid;v_count integer;v_term uuid;v_assignment uuid;
begin
 if v_actor is null then raise exception 'Authentication is required.';end if;v_school:=private.dreem_active_school_for_role(array['leadership','support','teacher']);
 if v_school is null or p_max_score<=0 then raise exception 'Assessment authorization and a positive maximum score are required.';end if;
 select t.id into v_term from public.dreem_terms t where t.school_id=v_school and p_assessment_date between t.starts_on and t.ends_on order by t.order_index limit 1;
 select ta.id into v_assignment from public.dreem_teaching_assignments ta join public.dreem_classes c on c.id=ta.class_id where ta.school_id=v_school and ta.term_id=v_term and ta.subject_id=p_subject_id and lower(c.name)=lower(trim(p_class_name)) and ta.teacher_user_id=v_actor and ta.status='active' limit 1;
 if v_assignment is null and not private.dreem_has_role(v_school,array['leadership','academic_head']) then raise exception 'Only the assigned teacher can submit this assessment.';end if;
 insert into public.dreem_assessments(school_id,subject_id,class_name,title,assessment_type,max_score,assessment_date,duration_minutes,paper_reference,question_summary,marking_guide,syllabus_objectives,status,created_by,idempotency_key,term_id,teaching_assignment_id)
 values(v_school,p_subject_id,trim(p_class_name),trim(p_title),p_assessment_type,p_max_score,p_assessment_date,p_duration_minutes,nullif(trim(p_paper_reference),''),nullif(trim(p_question_summary),''),nullif(trim(p_marking_guide),''),nullif(trim(p_syllabus_objectives),''),'submitted',v_actor,p_idempotency_key,v_term,v_assignment)
 on conflict(school_id,idempotency_key) do update set updated_at=now() returning id into v_id;
 insert into public.dreem_marks(school_id,assessment_id,student_id,score,comment,recorded_by) select v_school,v_id,(m->>'student_id')::uuid,(m->>'score')::numeric,nullif(m->>'comment',''),v_actor from jsonb_array_elements(p_marks)m join public.students s on s.id=(m->>'student_id')::uuid and s.school_id=v_school where(m->>'score')::numeric between 0 and p_max_score on conflict(assessment_id,student_id) do update set score=excluded.score,comment=excluded.comment;
 select count(*) into v_count from public.dreem_marks where assessment_id=v_id;if v_count=0 then raise exception 'No valid learner marks were supplied.';end if;
 perform private.dreem_write_event(v_school,'assessment',v_id,'assessment.submitted','assessment.submitted:'||p_idempotency_key,jsonb_build_object('type',p_assessment_type,'marks_count',v_count,'objectives',p_syllabus_objectives));assessment_id:=v_id;marks_count:=v_count;return next;
end;$$;

revoke all on function public.dreem_register_academic_document(text,text,text,text,text,text,bigint,uuid,uuid,uuid,uuid,uuid),public.dreem_record_assessment_v2(uuid,text,text,text,numeric,date,integer,text,text,text,text,jsonb,text) from public,anon;
grant execute on function public.dreem_register_academic_document(text,text,text,text,text,text,bigint,uuid,uuid,uuid,uuid,uuid),public.dreem_record_assessment_v2(uuid,text,text,text,numeric,date,integer,text,text,text,text,jsonb,text) to authenticated;
create index dreem_academic_documents_scope_idx on public.dreem_academic_documents(school_id,subject_id,class_id,document_type,status);
create trigger dreem_audit_academic_documents after insert or update or delete on public.dreem_academic_documents for each row execute function private.dreem_audit_row();
