-- Course access is all-or-nothing for students.
-- Unenrolled students may see the published course shell/listing, but no lesson
-- content, including lessons previously marked as preview.

drop policy if exists lessons_preview_read on public.course_lessons;
drop policy if exists lessons_enrolled_read on public.course_lessons;
drop policy if exists lessons_admin_read on public.course_lessons;

create policy lessons_admin_read
on public.course_lessons
for select to authenticated
using (public.is_admin());

create policy lessons_enrolled_read
on public.course_lessons
for select to authenticated
using (
  exists (
    select 1
    from public.course_modules m
    join public.enrollments e on e.course_id = m.course_id
    where m.id = course_lessons.module_id
      and e.user_id = auth.uid()
      and e.status in ('active', 'completed')
  )
);

drop policy if exists course_content_student_read on storage.objects;
create policy course_content_student_read
on storage.objects
for select to authenticated
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
        public.is_admin()
        or exists (
          select 1
          from public.enrollments e
          where e.course_id = c.id
            and e.user_id = auth.uid()
            and e.status in ('active', 'completed')
        )
      )
  )
);

notify pgrst, 'reload schema';
