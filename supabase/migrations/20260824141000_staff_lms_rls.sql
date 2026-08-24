create policy courses_staff_select
on public.courses
for select
to authenticated
using (public.is_staff());

create policy courses_staff_insert
on public.courses
for insert
to authenticated
with check (public.is_staff());

create policy courses_staff_update
on public.courses
for update
to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy courses_staff_delete
on public.courses
for delete
to authenticated
using (public.is_staff());

create policy modules_staff_select
on public.course_modules
for select
to authenticated
using (public.is_staff());

create policy modules_staff_insert
on public.course_modules
for insert
to authenticated
with check (public.is_staff());

create policy modules_staff_update
on public.course_modules
for update
to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy modules_staff_delete
on public.course_modules
for delete
to authenticated
using (public.is_staff());

create policy lessons_staff_select
on public.course_lessons
for select
to authenticated
using (public.is_staff());

create policy lessons_staff_insert
on public.course_lessons
for insert
to authenticated
with check (public.is_staff());

create policy lessons_staff_update
on public.course_lessons
for update
to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy lessons_staff_delete
on public.course_lessons
for delete
to authenticated
using (public.is_staff());

create policy lessons_enrolled_read
on public.course_lessons
for select
to authenticated
using (
  exists (
    select 1
    from public.course_modules m
    join public.courses c on c.id = m.course_id
    join public.enrollments e on e.course_id = c.id
    where m.id = course_lessons.module_id
      and e.user_id = auth.uid()
      and e.status in ('active', 'completed')
  )
);

create policy workshops_staff_select
on public.workshops
for select
to authenticated
using (public.is_staff());

create policy workshops_staff_insert
on public.workshops
for insert
to authenticated
with check (public.is_staff());

create policy workshops_staff_update
on public.workshops
for update
to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy workshops_staff_delete
on public.workshops
for delete
to authenticated
using (public.is_staff());
