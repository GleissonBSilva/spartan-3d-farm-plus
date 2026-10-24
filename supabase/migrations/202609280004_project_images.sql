alter table public.spartan_projects
  add column if not exists image_path text;

update storage.buckets
set allowed_mime_types = array[
  'model/stl', 'model/3mf', 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
  'text/plain', 'application/octet-stream', 'image/jpeg', 'image/png', 'image/webp'
]
where id = '3d-models';
