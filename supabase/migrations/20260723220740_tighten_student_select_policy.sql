drop policy if exists "Students visible within same school" on public.students;

create policy "Students visible within same school"
on public.students
for select
to authenticated
using (
  school_id = public.current_profile_school_id()
);
