-- Public image assets for member avatars or a studio logo used as the account identity image.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-images', 'profile-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "members read profile images" on storage.objects for select
using (bucket_id = 'profile-images');
create policy "members upload own profile image" on storage.objects for insert
with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "members update own profile image" on storage.objects for update
using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "members delete own profile image" on storage.objects for delete
using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);
