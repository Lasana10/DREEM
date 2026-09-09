create or replace function private.dreem_teacher_can_access_student(p_school_id uuid,p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1 from public.students s
    where s.id=p_student_id and s.school_id=p_school_id
      and private.dreem_teacher_can_access_class(s.school_id,s.class_name,null)
  );
$$;
revoke all on function private.dreem_teacher_can_access_student(uuid,uuid) from public;
grant execute on function private.dreem_teacher_can_access_student(uuid,uuid) to authenticated;

drop policy if exists dreem_student_record_insert on public.dreem_growth_snapshots;
create policy dreem_student_record_insert on public.dreem_growth_snapshots for insert to authenticated
with check (
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','academic_head'])
  or private.dreem_teacher_can_access_student(school_id,student_id)
);
drop policy if exists dreem_student_record_update on public.dreem_growth_snapshots;
create policy dreem_student_record_update on public.dreem_growth_snapshots for update to authenticated
using (
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','academic_head'])
  or private.dreem_teacher_can_access_student(school_id,student_id)
)
with check (
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','academic_head'])
  or private.dreem_teacher_can_access_student(school_id,student_id)
);
drop policy if exists dreem_student_record_delete on public.dreem_growth_snapshots;
create policy dreem_student_record_delete on public.dreem_growth_snapshots for delete to authenticated
using (private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','academic_head']));

drop policy if exists dreem_student_record_insert on public.dreem_interventions;
create policy dreem_student_record_insert on public.dreem_interventions for insert to authenticated
with check (
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','academic_head'])
  or private.dreem_teacher_can_access_student(school_id,student_id)
);
drop policy if exists dreem_student_record_update on public.dreem_interventions;
create policy dreem_student_record_update on public.dreem_interventions for update to authenticated
using (
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','academic_head'])
  or private.dreem_teacher_can_access_student(school_id,student_id)
)
with check (
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','academic_head'])
  or private.dreem_teacher_can_access_student(school_id,student_id)
);
drop policy if exists dreem_student_record_delete on public.dreem_interventions;
create policy dreem_student_record_delete on public.dreem_interventions for delete to authenticated
using (private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','academic_head']));

drop policy if exists dreem_teacher_growth_read on public.dreem_teacher_growth_snapshots;
create policy dreem_teacher_growth_read on public.dreem_teacher_growth_snapshots for select to authenticated
using (
  teacher_user_id=(select auth.uid())
  or private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','academic_head','auditor'])
);
drop policy if exists dreem_teacher_growth_insert on public.dreem_teacher_growth_snapshots;
create policy dreem_teacher_growth_insert on public.dreem_teacher_growth_snapshots for insert to authenticated
with check (private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','academic_head']));
drop policy if exists dreem_teacher_growth_update on public.dreem_teacher_growth_snapshots;
create policy dreem_teacher_growth_update on public.dreem_teacher_growth_snapshots for update to authenticated
using (private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','academic_head']))
with check (private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','academic_head']));
drop policy if exists dreem_teacher_growth_delete on public.dreem_teacher_growth_snapshots;
create policy dreem_teacher_growth_delete on public.dreem_teacher_growth_snapshots for delete to authenticated
using (private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','academic_head']));
