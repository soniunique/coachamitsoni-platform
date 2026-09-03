-- The program relationship is required by the access policies below.
-- Keep this migration self-contained so a clean migration reset does not
-- depend on a dashboard-only migration that may not exist in the repository.
alter table public.courses
  add column if not exists program_id uuid references public.programs(id) on delete set null;

create index if not exists courses_program_id_idx
  on public.courses(program_id);

create or replace function public.is_program_enrolled(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1
    from public.program_enrollments pe
    where pe.user_id = auth.uid()
      and pe.program_id = p_program_id
      and pe.status in ('active','completed')
  );
$$;

revoke all on function public.is_program_enrolled(uuid) from public, anon;
grant execute on function public.is_program_enrolled(uuid) to authenticated;

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
