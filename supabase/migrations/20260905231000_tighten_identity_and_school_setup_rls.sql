drop policy if exists dreem_students_identity_update on public.students;
create policy dreem_students_identity_update on public.students for update to authenticated
using ((select private.dreem_has_role(students.school_id,array['platform_founder','school_owner','principal','administrator'])))
with check ((select private.dreem_has_role(students.school_id,array['platform_founder','school_owner','principal','administrator'])));

drop policy if exists dreem_guardians_insert on public.dreem_guardians;
drop policy if exists dreem_guardians_update on public.dreem_guardians;
drop policy if exists dreem_guardians_delete on public.dreem_guardians;
create policy dreem_guardians_insert on public.dreem_guardians for insert to authenticated with check ((select private.dreem_has_role(dreem_guardians.school_id,array['platform_founder','school_owner','principal','administrator'])));
create policy dreem_guardians_update on public.dreem_guardians for update to authenticated using ((select private.dreem_has_role(dreem_guardians.school_id,array['platform_founder','school_owner','principal','administrator']))) with check ((select private.dreem_has_role(dreem_guardians.school_id,array['platform_founder','school_owner','principal','administrator'])));
create policy dreem_guardians_delete on public.dreem_guardians for delete to authenticated using ((select private.dreem_has_role(dreem_guardians.school_id,array['platform_founder','school_owner','principal','administrator'])));

drop policy if exists dreem_student_guardians_insert on public.dreem_student_guardians;
drop policy if exists dreem_student_guardians_update on public.dreem_student_guardians;
drop policy if exists dreem_student_guardians_delete on public.dreem_student_guardians;
create policy dreem_student_guardians_insert on public.dreem_student_guardians for insert to authenticated with check ((select private.dreem_has_role(dreem_student_guardians.school_id,array['platform_founder','school_owner','principal','administrator'])));
create policy dreem_student_guardians_update on public.dreem_student_guardians for update to authenticated using ((select private.dreem_has_role(dreem_student_guardians.school_id,array['platform_founder','school_owner','principal','administrator']))) with check ((select private.dreem_has_role(dreem_student_guardians.school_id,array['platform_founder','school_owner','principal','administrator'])));
create policy dreem_student_guardians_delete on public.dreem_student_guardians for delete to authenticated using ((select private.dreem_has_role(dreem_student_guardians.school_id,array['platform_founder','school_owner','principal','administrator'])));

drop policy if exists dreem_student_record_insert on public.dreem_student_credentials;
drop policy if exists dreem_student_record_update on public.dreem_student_credentials;
drop policy if exists dreem_student_record_delete on public.dreem_student_credentials;
create policy dreem_student_record_insert on public.dreem_student_credentials for insert to authenticated with check ((select private.dreem_has_role(dreem_student_credentials.school_id,array['platform_founder','school_owner','principal','administrator'])));
create policy dreem_student_record_update on public.dreem_student_credentials for update to authenticated using ((select private.dreem_has_role(dreem_student_credentials.school_id,array['platform_founder','school_owner','principal','administrator']))) with check ((select private.dreem_has_role(dreem_student_credentials.school_id,array['platform_founder','school_owner','principal','administrator'])));
create policy dreem_student_record_delete on public.dreem_student_credentials for delete to authenticated using ((select private.dreem_has_role(dreem_student_credentials.school_id,array['platform_founder','school_owner','principal','administrator'])));

do $block$
declare t text;
begin
  foreach t in array array['dreem_academic_years','dreem_terms','dreem_classes','dreem_subjects'] loop
    execute format('drop policy if exists %I_insert on public.%I',t,t);
    execute format('drop policy if exists %I_update on public.%I',t,t);
    execute format('drop policy if exists %I_delete on public.%I',t,t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check ((select private.dreem_has_role(school_id,array[''platform_founder'',''school_owner'',''principal'',''administrator'',''academic_head''])))',t,t);
    execute format('create policy %I_update on public.%I for update to authenticated using ((select private.dreem_has_role(school_id,array[''platform_founder'',''school_owner'',''principal'',''administrator'',''academic_head'']))) with check ((select private.dreem_has_role(school_id,array[''platform_founder'',''school_owner'',''principal'',''administrator'',''academic_head''])))',t,t);
    execute format('create policy %I_delete on public.%I for delete to authenticated using ((select private.dreem_has_role(school_id,array[''platform_founder'',''school_owner'',''principal'',''administrator'',''academic_head''])))',t,t);
  end loop;
end
$block$;

drop policy if exists dreem_school_brands_insert on public.dreem_school_brands;
drop policy if exists dreem_school_brands_update on public.dreem_school_brands;
drop policy if exists dreem_school_brands_delete on public.dreem_school_brands;
create policy dreem_school_brands_insert on public.dreem_school_brands for insert to authenticated with check ((select private.dreem_has_role(dreem_school_brands.school_id,array['platform_founder','school_owner','principal','administrator'])));
create policy dreem_school_brands_update on public.dreem_school_brands for update to authenticated using ((select private.dreem_has_role(dreem_school_brands.school_id,array['platform_founder','school_owner','principal','administrator']))) with check ((select private.dreem_has_role(dreem_school_brands.school_id,array['platform_founder','school_owner','principal','administrator'])));
create policy dreem_school_brands_delete on public.dreem_school_brands for delete to authenticated using ((select private.dreem_has_role(dreem_school_brands.school_id,array['platform_founder','school_owner','principal'])));