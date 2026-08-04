create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  classroom_material_id uuid not null references public.classroom_materials(id) on delete cascade,
  classroom_title text not null,
  student_id uuid not null references public.students(id) on delete cascade,
  student_name text not null,
  class_name text,
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  response text not null,
  status text not null default 'submitted' check (
    status in ('submitted', 'reviewed', 'needs-revision')
  ),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  feedback text,
  score text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists assignment_submissions_school_status_idx
on public.assignment_submissions (school_id, status, submitted_at desc);

create index if not exists assignment_submissions_student_idx
on public.assignment_submissions (student_id, submitted_at desc);

alter table public.assignment_submissions enable row level security;

revoke all on public.assignment_submissions from authenticated;
grant select, insert, update on public.assignment_submissions to authenticated;

drop policy if exists "Assignment submissions visible to academic staff and linked families"
on public.assignment_submissions;
create policy "Assignment submissions visible to academic staff and linked families"
on public.assignment_submissions
for select
to authenticated
using (
  school_id = public.current_profile_school_id()
  and (
    public.current_user_can('academics.attendance.write')
    or public.current_user_can('reporting.view')
    or submitted_by = (select auth.uid())
    or exists (
      select 1
      from public.students s
      join public.profiles p on p.id = (select auth.uid())
      where s.id = assignment_submissions.student_id
        and s.school_id = assignment_submissions.school_id
        and (
          p.matricule = s.matricule
          or p.id = any(coalesce(s.parent_user_ids, array[]::uuid[]))
        )
    )
  )
);

drop policy if exists "Assignment submissions inserted by academic staff or linked families"
on public.assignment_submissions;
create policy "Assignment submissions inserted by academic staff or linked families"
on public.assignment_submissions
for insert
to authenticated
with check (
  school_id = public.current_profile_school_id()
  and submitted_by = (select auth.uid())
  and exists (
    select 1
    from public.classroom_materials cm
    where cm.id = classroom_material_id
      and cm.school_id = assignment_submissions.school_id
      and cm.delivery = 'assignment'
  )
  and exists (
    select 1
    from public.students s
    join public.profiles p on p.id = (select auth.uid())
    where s.id = assignment_submissions.student_id
      and s.school_id = assignment_submissions.school_id
      and (
        public.current_user_can('academics.attendance.write')
        or p.matricule = s.matricule
        or p.id = any(coalesce(s.parent_user_ids, array[]::uuid[]))
      )
  )
);

drop policy if exists "Assignment submissions reviewed by academic staff"
on public.assignment_submissions;
create policy "Assignment submissions reviewed by academic staff"
on public.assignment_submissions
for update
to authenticated
using (
  school_id = public.current_profile_school_id()
  and public.current_user_can('academics.attendance.write')
)
with check (
  school_id = public.current_profile_school_id()
  and public.current_user_can('academics.attendance.write')
);
