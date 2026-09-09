drop policy if exists dreem_assignment_submissions_read on public.dreem_assignment_submissions;
create policy dreem_assignment_submissions_read
on public.dreem_assignment_submissions
for select
to authenticated
using (
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','academic_head','auditor'])
  or private.dreem_teacher_owns_learning_assignment(school_id,assignment_id)
  or private.dreem_is_family_of_student(school_id,student_id)
);

drop policy if exists dreem_assignments_read on public.dreem_assignments;
create policy dreem_assignments_read
on public.dreem_assignments
for select
to authenticated
using (
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','academic_head','auditor'])
  or private.dreem_teacher_owns_learning_assignment(school_id,id)
  or (
    status in ('published','closed')
    and exists (
      select 1
      from public.students s
      join public.dreem_classes c on c.id=dreem_assignments.class_id and c.school_id=dreem_assignments.school_id
      where s.school_id=dreem_assignments.school_id
        and lower(coalesce(s.class_name,''))=lower(c.name)
        and private.dreem_is_family_of_student(s.school_id,s.id)
    )
  )
);

drop policy if exists dreem_marks_read on public.dreem_marks;
create policy dreem_marks_read
on public.dreem_marks
for select
to authenticated
using (
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','academic_head','auditor'])
  or private.dreem_teacher_owns_assessment(school_id,assessment_id)
  or private.dreem_is_family_of_student(school_id,student_id)
);

drop policy if exists dreem_report_card_results_read on public.dreem_report_card_results;
create policy dreem_report_card_results_read
on public.dreem_report_card_results
for select
to authenticated
using (
  exists (
    select 1
    from public.dreem_report_cards c
    join public.students s on s.id=c.student_id and s.school_id=c.school_id
    where c.id=dreem_report_card_results.report_card_id
      and c.school_id=dreem_report_card_results.school_id
      and (
        private.dreem_has_role(c.school_id,array['platform_founder','school_owner','principal','administrator','academic_head','auditor'])
        or private.dreem_teacher_can_access_class(c.school_id,s.class_name,c.term_id)
        or (c.status='published' and private.dreem_is_family_of_student(c.school_id,c.student_id))
      )
  )
);

drop policy if exists dreem_guardians_read on public.dreem_guardians;
create policy dreem_guardians_read
on public.dreem_guardians
for select
to authenticated
using (
  user_id=(select auth.uid())
  or private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','academic_head'])
  or exists (
    select 1
    from public.dreem_student_guardians sg
    join public.students s on s.id=sg.student_id and s.school_id=sg.school_id
    where sg.guardian_id=dreem_guardians.id
      and sg.school_id=dreem_guardians.school_id
      and private.dreem_teacher_can_access_class(s.school_id,s.class_name,null)
  )
);

drop policy if exists dreem_student_guardians_read on public.dreem_student_guardians;
create policy dreem_student_guardians_read
on public.dreem_student_guardians
for select
to authenticated
using (
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','academic_head'])
  or private.dreem_is_family_of_student(school_id,student_id)
  or exists (
    select 1 from public.students s
    where s.id=dreem_student_guardians.student_id
      and s.school_id=dreem_student_guardians.school_id
      and private.dreem_teacher_can_access_class(s.school_id,s.class_name,null)
  )
);

drop policy if exists dreem_academic_documents_read on public.dreem_academic_documents;
create policy dreem_academic_documents_read
on public.dreem_academic_documents
for select
to authenticated
using (
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','academic_head','auditor'])
  or uploaded_by=(select auth.uid())
  or (
    (class_id is not null or subject_id is not null)
    and exists (
      select 1 from public.dreem_teaching_assignments ta
      where ta.school_id=dreem_academic_documents.school_id
        and ta.teacher_user_id=(select auth.uid())
        and ta.status in ('planned','active')
        and (dreem_academic_documents.class_id is null or ta.class_id=dreem_academic_documents.class_id)
        and (dreem_academic_documents.subject_id is null or ta.subject_id=dreem_academic_documents.subject_id)
    )
  )
);
