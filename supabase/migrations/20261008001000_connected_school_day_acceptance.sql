do $$
declare
  v_school uuid; v_teacher uuid; v_founder uuid; v_founder_membership uuid;
  v_assignment uuid; v_year uuid; v_term uuid; v_class uuid; v_subject uuid; v_class_name text; v_assessment_date date;
  v_student uuid; v_guardian uuid; v_outcome uuid; v_attendance uuid; v_attendance_count integer;
  v_lesson uuid; v_lesson_status text; v_assessment uuid; v_marks_count integer;
  v_case uuid; v_case_number text; v_case_status text; v_announcement uuid; v_delivery uuid;
  v_family_visible integer:=0; v_ack_status text; v_closed integer:=0; v_pass boolean:=false;
begin
  select ta.school_id,ta.teacher_user_id,ta.id,ta.academic_year_id,ta.term_id,ta.class_id,ta.subject_id,c.name,t.starts_on
  into v_school,v_teacher,v_assignment,v_year,v_term,v_class,v_subject,v_class_name,v_assessment_date
  from public.dreem_teaching_assignments ta
  join public.dreem_classes c on c.id=ta.class_id
  join public.dreem_terms t on t.id=ta.term_id
  where ta.status='active'
  limit 1;

  select m.id,m.profile_id into v_founder_membership,v_founder
  from public.dreem_school_memberships m
  where m.school_id=v_school and m.role='platform_founder' and m.status='approved'
  limit 1;

  if v_school is null or v_teacher is null or v_founder is null or v_assignment is null or v_term is null then
    insert into public.dreem_acceptance_evidence(school_id,scenario,status,detail,source)
    values(v_school,'connected_school_day_teacher_support_family','blocked',jsonb_build_object('reason','Representative teacher/founder/term unavailable'),'20261008001000_connected_school_day_acceptance');
    return;
  end if;

  begin
    insert into public.students(school_id,matricule,full_name,class_name)
    values(v_school,'DAY-ACCEPT-'||substr(gen_random_uuid()::text,1,8),'School Day Acceptance Learner',trim(v_class_name))
    returning id into v_student;

    insert into public.dreem_guardians(school_id,user_id,full_name,email,preferred_language)
    values(v_school,v_founder,'Acceptance Family','acceptance.family@example.invalid','en')
    returning id into v_guardian;

    insert into public.dreem_student_guardians(school_id,student_id,guardian_id,relationship,is_primary,receives_finance,can_collect)
    values(v_school,v_student,v_guardian,'guardian',true,true,false);

    insert into public.dreem_curriculum_outcomes(
      school_id,academic_year_id,class_id,subject_id,code,title_en,title_fr,description,source,status,created_by
    ) values(
      v_school,v_year,v_class,v_subject,'ACC-DAY-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
      'Explain one idea using evidence','Expliquer une idée avec des preuves',
      'Acceptance outcome for a rollback-only school-day scenario.','school','active',v_teacher
    ) returning id into v_outcome;

    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_teacher::text,'role','authenticated')::text,true);

    select session_id,recorded_count into v_attendance,v_attendance_count
    from public.dreem_record_attendance(
      trim(v_class_name),current_date,'ACCEPTANCE',
      jsonb_build_array(jsonb_build_object('student_id',v_student,'status','present','note','Acceptance day')),
      'day-attendance-'||gen_random_uuid()::text
    );
    if v_attendance_count<>1 then raise exception 'Teacher attendance did not record one learner'; end if;

    select lesson_plan_id,lesson_plan_status into v_lesson,v_lesson_status
    from public.dreem_record_lesson_plan_with_outcomes(
      v_assignment,current_date,'Acceptance lesson',
      'Learner explains one idea using cited evidence.',
      'Read, compare, discuss and write a short response.',
      'One written response and teacher observation.',
      'Follow up if evidence is missing.',
      array[v_outcome],
      'day-lesson-'||gen_random_uuid()::text
    );
    if v_lesson is null then raise exception 'Teacher lesson plan was not recorded'; end if;

    select assessment_id,marks_count into v_assessment,v_marks_count
    from public.dreem_record_assessment(
      v_subject,trim(v_class_name),'Acceptance assessment',10,v_assessment_date,
      jsonb_build_array(jsonb_build_object('student_id',v_student,'score',6,'comment','Needs evidence follow-up')),
      'day-assessment-'||gen_random_uuid()::text
    );
    if v_marks_count<>1 then raise exception 'Teacher assessment did not record one learner mark'; end if;

    select case_id,case_number,case_status into v_case,v_case_number,v_case_status
    from public.dreem_open_student_case(
      v_student,'learning_support','important','Evidence support needed',
      'Assessment shows the learner needs follow-up on using evidence.',
      current_date+3,v_teacher,'day-case-'||gen_random_uuid()::text
    );

    select case_id,case_status into v_case,v_case_status
    from public.dreem_progress_student_case(
      v_case,'in_progress','Teacher started targeted evidence practice.',v_teacher,current_date+2,'day-case-progress-'||gen_random_uuid()::text
    );

    select case_id,case_status into v_case,v_case_status
    from public.dreem_progress_student_case(
      v_case,'resolved','Learner completed targeted practice and demonstrated the expected evidence skill.',v_teacher,current_date,'day-case-resolved-'||gen_random_uuid()::text
    );

    select case_id,case_status into v_case,v_case_status
    from public.dreem_progress_student_case(
      v_case,'closed','Outcome verified in class and family follow-up prepared for closure.',v_teacher,current_date,'day-case-closed-'||gen_random_uuid()::text
    );
    if v_case_status<>'closed' then raise exception 'Learner support case did not reach closure'; end if;

    insert into public.dreem_announcements(
      school_id,title,body,audience,category,priority,publication_status,created_by,approved_by,approved_at,published_at
    ) values(
      v_school,'Learning support follow-up',
      'Your child completed the targeted evidence practice. The teacher will continue normal classroom monitoring.',
      'families','academic','important','published',v_teacher,v_teacher,now(),now()
    ) returning id into v_announcement;

    insert into public.dreem_notification_deliveries(
      school_id,announcement_id,recipient_user_id,channel,status,sent_at,delivered_at
    ) values(v_school,v_announcement,v_founder,'in_app','delivered',now(),now())
    returning id into v_delivery;

    update public.dreem_school_memberships set role='parent' where id=v_founder_membership;
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_founder::text,'role','authenticated')::text,true);

    select count(*) into v_family_visible
    from public.dreem_my_notification_deliveries d
    where d.id=v_delivery
      and d.title='Learning support follow-up'
      and d.body like 'Your child completed the targeted evidence practice.%';

    if v_family_visible<>1 then raise exception 'Family-scoped delivery was not visible to the linked guardian'; end if;

    v_ack_status:=public.dreem_acknowledge_notification_delivery(v_delivery);
    if v_ack_status<>'acknowledged' then raise exception 'Family acknowledgement was not recorded'; end if;

    select count(*) into v_closed
    from public.dreem_student_cases
    where id=v_case and status='closed';

    if v_closed<>1 then raise exception 'Support closure was not persisted'; end if;

    v_pass:=true;
    raise exception using errcode='P0001',message='DREEM_ACCEPTANCE_ROLLBACK';
  exception when sqlstate 'P0001' then
    if sqlerrm<>'DREEM_ACCEPTANCE_ROLLBACK' then raise; end if;
  end;

  if v_pass then
    insert into public.dreem_acceptance_evidence(school_id,scenario,status,detail,source)
    values(v_school,'connected_school_day_teacher_support_family','passed',
      jsonb_build_object(
        'attendance_recorded',true,
        'curriculum_linked_lesson_recorded',true,
        'assessment_recorded',true,
        'support_case_closed',true,
        'family_guardian_linked',true,
        'family_delivery_visible',true,
        'family_acknowledged',true,
        'fixture_rolled_back',true
      ),
      '20261008001000_connected_school_day_acceptance');
  end if;
end $$;