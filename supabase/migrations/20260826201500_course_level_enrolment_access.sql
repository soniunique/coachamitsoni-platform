-- Course-level enrolment is the only access assignment model for now.
-- An active/completed enrolment grants read access to every module and lesson
-- belonging to the course. Students never receive content-management rights.

create or replace function public.admin_set_course_enrollment(
  p_course_id uuid,
  p_user_id uuid,
  p_enrolled boolean
)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.enrollments;
begin
  if not public.is_admin() then
    raise exception 'Only admins can manage course enrolments';
  end if;

  if not exists (select 1 from public.courses where id = p_course_id) then
    raise exception 'Course not found';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id and role = 'student') then
    raise exception 'Only student users can be enrolled';
  end if;

  if p_enrolled then
    insert into public.enrollments (user_id, course_id, status, progress_percent, enrolled_at, completed_at)
    values (p_user_id, p_course_id, 'active', 0, now(), null)
    on conflict (user_id, course_id) do update
      set status = 'active',
          progress_percent = case when public.enrollments.status = 'cancelled' then 0 else public.enrollments.progress_percent end,
          enrolled_at = case when public.enrollments.status = 'cancelled' then now() else public.enrollments.enrolled_at end,
          completed_at = case when public.enrollments.status = 'cancelled' then null else public.enrollments.completed_at end
    returning * into result;
  else
    update public.enrollments
       set status = 'cancelled', completed_at = null
     where course_id = p_course_id
       and user_id = p_user_id
       and status <> 'cancelled'
    returning * into result;

    if result.id is null then
      raise exception 'Active enrolment not found';
    end if;
  end if;

  return result;
end;
$$;

grant execute on function public.admin_set_course_enrollment(uuid, uuid, boolean) to authenticated;

-- Keep the course-level lesson access rule explicit and unchanged: an enrolled
-- student can read every lesson in every module of the enrolled course.
drop policy if exists lessons_enrolled_read on public.course_lessons;
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

-- Modules are read-only content. Keep them visible for published courses;
-- there are deliberately no student insert/update/delete policies.
drop policy if exists modules_public_read on public.course_modules;
create policy modules_public_read
on public.course_modules
for select to anon, authenticated
using (
  exists (
    select 1 from public.courses c
    where c.id = course_modules.course_id
      and c.status = 'published'
  )
);
