insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dreem-identity-media','dreem-identity-media',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists dreem_students_identity_update on public.students;
create policy dreem_students_identity_update on public.students
for update to authenticated
using ((select private.dreem_has_role(students.school_id, array['leadership'::text,'support'::text])))
with check ((select private.dreem_has_role(students.school_id, array['leadership'::text,'support'::text])));

drop policy if exists dreem_identity_media_read on storage.objects;
create policy dreem_identity_media_read on storage.objects
for select to authenticated
using (
  bucket_id = 'dreem-identity-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and (select private.dreem_can_view_student(((storage.foldername(name))[1])::uuid, ((storage.foldername(name))[2])::uuid))
);

drop policy if exists dreem_identity_media_insert on storage.objects;
create policy dreem_identity_media_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'dreem-identity-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and (select private.dreem_has_role(((storage.foldername(name))[1])::uuid, array['leadership'::text,'support'::text]))
);

drop policy if exists dreem_identity_media_update on storage.objects;
create policy dreem_identity_media_update on storage.objects
for update to authenticated
using (
  bucket_id = 'dreem-identity-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and (select private.dreem_has_role(((storage.foldername(name))[1])::uuid, array['leadership'::text,'support'::text]))
)
with check (
  bucket_id = 'dreem-identity-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and (select private.dreem_has_role(((storage.foldername(name))[1])::uuid, array['leadership'::text,'support'::text]))
);

drop policy if exists dreem_identity_media_delete on storage.objects;
create policy dreem_identity_media_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'dreem-identity-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and (select private.dreem_has_role(((storage.foldername(name))[1])::uuid, array['leadership'::text]))
);