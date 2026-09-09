create or replace function private.dreem_is_family_of_student(p_school_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.students s
      where s.id = p_student_id
        and s.school_id = p_school_id
        and (
          s.profile_id = (select auth.uid())
          or (select auth.uid()) = any(coalesce(s.parent_user_ids, array[]::uuid[]))
        )
    );
$$;

revoke all on function private.dreem_is_family_of_student(uuid, uuid) from public;
grant execute on function private.dreem_is_family_of_student(uuid, uuid) to authenticated;

create or replace function private.dreem_teacher_can_access_class(
  p_school_id uuid,
  p_class_name text,
  p_term_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.dreem_teaching_assignments ta
      join public.dreem_classes c
        on c.id = ta.class_id
       and c.school_id = ta.school_id
      where ta.school_id = p_school_id
        and ta.teacher_user_id = (select auth.uid())
        and ta.status in ('planned','active')
        and lower(c.name) = lower(coalesce(p_class_name, ''))
        and (p_term_id is null or ta.term_id = p_term_id)
    );
$$;

revoke all on function private.dreem_teacher_can_access_class(uuid, text, uuid) from public;
grant execute on function private.dreem_teacher_can_access_class(uuid, text, uuid) to authenticated;

drop policy if exists dreem_attendance_read on public.dreem_attendance_sessions;
create policy dreem_attendance_read
on public.dreem_attendance_sessions
for select
to authenticated
using (
  private.dreem_has_role(
    school_id,
    array['platform_founder','school_owner','principal','administrator','academic_head','auditor']
  )
  or private.dreem_teacher_can_access_class(school_id, class_name, null)
  or exists (
    select 1
    from public.students s
    where s.school_id = dreem_attendance_sessions.school_id
      and lower(coalesce(s.class_name,'')) = lower(coalesce(dreem_attendance_sessions.class_name,''))
      and private.dreem_is_family_of_student(s.school_id, s.id)
  )
);

drop policy if exists dreem_attendance_marks_read on public.dreem_attendance_marks;
create policy dreem_attendance_marks_read
on public.dreem_attendance_marks
for select
to authenticated
using (
  private.dreem_has_role(
    school_id,
    array['platform_founder','school_owner','principal','administrator','academic_head','auditor']
  )
  or exists (
    select 1
    from public.dreem_attendance_sessions ses
    where ses.id = dreem_attendance_marks.session_id
      and ses.school_id = dreem_attendance_marks.school_id
      and private.dreem_teacher_can_access_class(ses.school_id, ses.class_name, null)
  )
  or private.dreem_is_family_of_student(school_id, student_id)
);

drop policy if exists dreem_report_cards_read on public.dreem_report_cards;
create policy dreem_report_cards_read
on public.dreem_report_cards
for select
to authenticated
using (
  private.dreem_has_role(
    school_id,
    array['platform_founder','school_owner','principal','administrator','academic_head','auditor']
  )
  or exists (
    select 1
    from public.students s
    where s.id = dreem_report_cards.student_id
      and s.school_id = dreem_report_cards.school_id
      and private.dreem_teacher_can_access_class(
        dreem_report_cards.school_id,
        s.class_name,
        dreem_report_cards.term_id
      )
  )
  or (
    status = 'published'
    and private.dreem_is_family_of_student(school_id, student_id)
  )
);
