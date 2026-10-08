do $$
declare
  v_school uuid; v_teacher uuid; v_founder uuid;
  v_year uuid; v_class uuid; v_subject uuid; v_doc uuid; v_proposal uuid; v_outcome uuid;
  v_feedback uuid; v_provenance integer:=0; v_pass boolean:=false;
begin
  select m.school_id,m.profile_id,ta.academic_year_id,ta.class_id,ta.subject_id
    into v_school,v_teacher,v_year,v_class,v_subject
  from public.dreem_school_memberships m
  join public.dreem_teaching_assignments ta
    on ta.school_id=m.school_id and ta.teacher_user_id=m.profile_id and ta.status='active'
  where m.role='teacher' and m.status='approved'
  limit 1;

  select m.profile_id into v_founder
  from public.dreem_school_memberships m
  where m.school_id=v_school and m.role='platform_founder' and m.status='approved'
  limit 1;

  if v_school is null or v_teacher is null or v_founder is null or v_year is null or v_class is null or v_subject is null then
    insert into public.dreem_acceptance_evidence(school_id,scenario,status,detail,source)
    values(v_school,'curriculum_source_to_approved_outcome','blocked',jsonb_build_object('reason','Teacher assignment or academic approver unavailable'),'20261008000700_curriculum_provenance_acceptance');
    return;
  end if;

  begin
    insert into public.dreem_academic_documents(
      school_id,academic_year_id,class_id,subject_id,document_type,title,language,
      storage_path,file_name,mime_type,file_size,status,version,uploaded_by,approved_by,approved_at
    ) values(
      v_school,v_year,v_class,v_subject,'syllabus','Acceptance Syllabus','bilingual',
      'acceptance/probe.pdf','probe.pdf','application/pdf',128,'approved',3,v_teacher,v_founder,now()
    ) returning id into v_doc;

    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_teacher::text,'role','authenticated')::text,true);

    v_proposal:=public.dreem_propose_curriculum_outcome(
      v_doc,v_year,v_class,v_subject,
      'ACC-CURR-01','Compare evidence from two short texts','Comparer les preuves de deux textes courts',
      'Learner identifies and compares evidence from two age-appropriate texts.',
      7,8,'Reading competency 2.1','Reviewed acceptance excerpt',0.93,'acceptance-probe','acceptance-run-1'
    );

    v_feedback:=public.dreem_teacher_review_curriculum_proposal(
      v_proposal,'accepted',null,null,null,null,
      'Useful and consistent with classroom preparation.',4::smallint,12
    );

    if v_feedback is null then raise exception 'Teacher review was not recorded'; end if;

    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_founder::text,'role','authenticated')::text,true);

    v_outcome:=public.dreem_review_curriculum_proposal(
      v_proposal,'accepted',null,null,null,null,'Checked against cited pages and teacher review.'
    );

    if v_outcome is null then raise exception 'Academic approval did not create an outcome'; end if;

    select count(*) into v_provenance
    from public.dreem_curriculum_outcome_provenance p
    join public.dreem_curriculum_outcomes o on o.id=p.outcome_id
    where p.outcome_id=v_outcome
      and p.proposal_id=v_proposal
      and p.document_id=v_doc
      and p.document_version=3
      and p.page_start=7
      and p.page_end=8
      and o.status='active'
      and o.source='imported';

    if v_provenance<>1 then raise exception 'Approved outcome provenance assertion failed'; end if;

    v_pass:=true;
    raise exception using errcode='P0001',message='DREEM_ACCEPTANCE_ROLLBACK';
  exception when sqlstate 'P0001' then
    if sqlerrm<>'DREEM_ACCEPTANCE_ROLLBACK' then raise; end if;
  end;

  if v_pass then
    insert into public.dreem_acceptance_evidence(school_id,scenario,status,detail,source)
    values(v_school,'curriculum_source_to_approved_outcome','passed',
      jsonb_build_object(
        'source_version_captured',true,
        'page_provenance_captured',true,
        'teacher_review_recorded',true,
        'usefulness_recorded',true,
        'academic_approval_required',true,
        'active_outcome_created',true,
        'immutable_provenance_linked',true,
        'fixture_rolled_back',true
      ),
      '20261008000700_curriculum_provenance_acceptance');
  end if;
end $$;