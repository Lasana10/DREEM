+-- Versioned public school logos. Upload rights remain school-scoped.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('school-brand-assets','school-brand-assets',true,2097152,array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists dreem_brand_assets_insert on storage.objects;
create policy dreem_brand_assets_insert on storage.objects for insert to authenticated
with check (
  bucket_id='school-brand-assets'
  and (storage.foldername(name))[1] in (
    select m.school_id::text from public.dreem_school_memberships m
    where m.profile_id=(select auth.uid()) and m.status='approved'
      and m.role in ('platform_founder','school_owner','principal','administrator')
  )
  and lower(storage.extension(name)) in ('png','jpg','jpeg','webp','svg')
);

-- Logos are deliberately immutable: updates and deletes are not granted. A replacement is a new object version.
