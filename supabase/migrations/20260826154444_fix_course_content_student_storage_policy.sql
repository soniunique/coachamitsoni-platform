-- Allow enrolled students and published preview lessons to read private lesson files.
-- The upload path is stored in course_lessons.content_storage_path; it is not
-- guaranteed to use the lesson UUID as the first storage folder segment.

drop policy if exists "course_content_student_read" on storage.objects;
create policy "course_content_student_read" on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'course-content'
  and exists (
    select 1
    from public.course_lessons l
    join public.course_modules m on m.id = l.module_id
    join public.courses c on c.id = m.course_id
    where l.content_storage_path = storage.objects.name
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
