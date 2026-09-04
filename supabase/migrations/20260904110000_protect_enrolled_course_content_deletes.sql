-- Preserve learner history when Admin manages course content.
-- Once a program has any enrollment record, modules and lessons in its courses
-- cannot be deleted. Admins should edit or archive content instead.

create or replace function public.prevent_enrolled_course_content_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
begin
  if tg_table_name = 'course_modules' then
    v_course_id := old.course_id;
  elsif tg_table_name = 'course_lessons' then
    select m.course_id into v_course_id
    from public.course_modules m
    where m.id = old.module_id;
  else
    raise exception 'Unsupported course content table';
  end if;

  if exists (
    select 1
    from public.program_enrollments pe
    join public.courses c on c.program_id = pe.program_id
    where c.id = v_course_id
  ) then
    raise exception 'Cannot delete course content after a learner has been enrolled in this program. Archive or edit the content instead.'
      using errcode = '23503';
  end if;

  return old;
end;
$$;

revoke all on function public.prevent_enrolled_course_content_delete() from public, anon, authenticated;
grant execute on function public.prevent_enrolled_course_content_delete() to service_role;

drop trigger if exists prevent_module_delete_with_program_enrollments on public.course_modules;
create trigger prevent_module_delete_with_program_enrollments
before delete on public.course_modules
for each row execute function public.prevent_enrolled_course_content_delete();

drop trigger if exists prevent_lesson_delete_with_program_enrollments on public.course_lessons;
create trigger prevent_lesson_delete_with_program_enrollments
before delete on public.course_lessons
for each row execute function public.prevent_enrolled_course_content_delete();
