-- Lesson content editor + private course-content storage.
-- Additive only: existing lesson URLs and rows remain intact.

alter table public.course_lessons
  add column if not exists content_body text,
  add column if not exists content_storage_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-content',
  'course-content',
  false,
  1073741824,
  array[
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-matroska',
    'application/pdf'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Staff can manage course-content files. The first path segment must be a lesson UUID.
drop policy if exists "course_content_staff_insert" on storage.objects;
create policy "course_content_staff_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'course-content'
  and is_staff()
  and (storage.foldername(name))[1] is not null
);

drop policy if exists "course_content_staff_select" on storage.objects;
create policy "course_content_staff_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'course-content'
  and is_staff()
);

drop policy if exists "course_content_staff_update" on storage.objects;
create policy "course_content_staff_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'course-content'
  and is_staff()
)
with check (
  bucket_id = 'course-content'
  and is_staff()
);

drop policy if exists "course_content_staff_delete" on storage.objects;
create policy "course_content_staff_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'course-content'
  and is_staff()
);

-- Students may read stored lesson files when enrolled, while preview lessons are
-- readable for published courses without enrollment. The storage path begins
-- with the lesson UUID so access can be checked against the lesson record.
drop policy if exists "course_content_student_read" on storage.objects;
create policy "course_content_student_read"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'course-content'
  and exists (
    select 1
    from public.course_lessons l
    join public.course_modules m on m.id = l.module_id
    join public.courses c on c.id = m.course_id
    where l.id::text = (storage.foldername(name))[1]
      and c.status = 'published'
      and (
        l.is_preview = true
        or exists (
          select 1
          from public.enrollments e
          where e.course_id = c.id
            and e.user_id = auth.uid()
            and e.status = any (array['active'::text, 'completed'::text])
        )
      )
  )
);
