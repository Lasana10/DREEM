-- Keep teacher read access aligned with assigned teaching work rather than school-wide academic records.
-- Leadership/academic review/audit roles retain institutional visibility; learner/family access continues through dreem_can_view_student.

drop policy if exists dreem_assignments_read on public.dreem_assignments;
create policy dreem_assignments_read on public.dreem_assignments for select to authenticated using (
  private.dreem_has_role(school_id,array['leadership','administrator','academic_head','auditor'])
  or exists (
    select 1 from public.dreem_teaching_assignments ta
    where ta.id=dreem_assignments.teaching_assignment_id
      and ta.school_id=dreem_assignments.school_id
      and ta.teacher_user_id=(select auth.uid())
  )
  or (
    status in ('published','closed')
    and exists (
      select 1 from public.students s
      join public.dreem_classes c on c.id=dreem_assignments.class_id
      where s.school_id=dreem_assignments.school_id
        and lower(s.class_name)=lower(c.name)
        and private.dreem_can_view_student(s.school_id,s.id)
    )
  )
);

drop policy if exists dreem_assignment_submissions_read on public.dreem_assignment_submissions;
create policy dreem_assignment_submissions_read on public.dreem_assignment_submissions for select to authenticated using (
  private.dreem_has_role(school_id,array['leadership','administrator','academic_head','auditor'])
  or exists (
    select 1 from public.dreem_assignments a
    join public.dreem_teaching_assignments ta on ta.id=a.teaching_assignment_id
    where a.id=dreem_assignment_submissions.assignment_id
      and a.school_id=dreem_assignment_submissions.school_id
      and ta.teacher_user_id=(select auth.uid())
  )
  or private.dreem_can_view_student(school_id,student_id)
);

drop policy if exists dreem_assessments_read on public.dreem_assessments;
create policy dreem_assessments_read on public.dreem_assessments for select to authenticated using (
  private.dreem_has_role(school_id,array['leadership','academic_head','auditor'])
  or exists (
    select 1 from public.dreem_teaching_assignments ta
    where ta.id=dreem_assessments.teaching_assignment_id
      and ta.school_id=dreem_assessments.school_id
      and ta.teacher_user_id=(select auth.uid())
  )
);

drop policy if exists dreem_marks_read on public.dreem_marks;
create policy dreem_marks_read on public.dreem_marks for select to authenticated using (
  private.dreem_has_role(school_id,array['leadership','academic_head','auditor'])
  or exists (
    select 1 from public.dreem_assessments a
    join public.dreem_teaching_assignments ta on ta.id=a.teaching_assignment_id
    where a.id=dreem_marks.assessment_id
      and a.school_id=dreem_marks.school_id
      and ta.teacher_user_id=(select auth.uid())
  )
  or private.dreem_can_view_student(school_id,student_id)
);
