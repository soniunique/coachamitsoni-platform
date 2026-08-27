drop policy if exists courses_public_read on public.courses;
create policy courses_program_enrolled_read on public.courses
  for select to authenticated
  using (status = 'published' and is_program_enrolled(program_id));

drop policy if exists modules_public_read on public.course_modules;
create policy modules_program_enrolled_read on public.course_modules
  for select to authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_modules.course_id
      and c.status = 'published'
      and is_program_enrolled(c.program_id)
  ));

drop policy if exists lesson_progress_own on public.lesson_progress;
create policy lesson_progress_own_read on public.lesson_progress
  for select to authenticated
  using (
    user_id = auth.uid() and exists (
      select 1
      from public.course_lessons l
      join public.course_modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
      where l.id = lesson_progress.lesson_id
        and c.status = 'published'
        and is_program_enrolled(c.program_id)
    )
  );
create policy lesson_progress_own_insert on public.lesson_progress
  for insert to authenticated
  with check (
    user_id = auth.uid() and exists (
      select 1
      from public.course_lessons l
      join public.course_modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
      where l.id = lesson_progress.lesson_id
        and c.status = 'published'
        and is_program_enrolled(c.program_id)
    )
  );
create policy lesson_progress_own_update on public.lesson_progress
  for update to authenticated
  using (user_id = auth.uid() and exists (
      select 1 from public.course_lessons l
      join public.course_modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
      where l.id = lesson_progress.lesson_id and c.status = 'published' and is_program_enrolled(c.program_id)
  ))
  with check (user_id = auth.uid() and exists (
      select 1 from public.course_lessons l
      join public.course_modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
      where l.id = lesson_progress.lesson_id and c.status = 'published' and is_program_enrolled(c.program_id)
  ));
create policy lesson_progress_own_delete on public.lesson_progress
  for delete to authenticated
  using (user_id = auth.uid() and exists (
      select 1 from public.course_lessons l
      join public.course_modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
      where l.id = lesson_progress.lesson_id and c.status = 'published' and is_program_enrolled(c.program_id)
  ));
