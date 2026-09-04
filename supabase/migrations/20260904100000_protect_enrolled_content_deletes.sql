create or replace function public.prevent_enrolled_content_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_enrollment_exists boolean;
begin
  if tg_table_name = 'course_modules' then
    v_course_id := old.course_id;
  elsif tg_table_name = 'course_lessons' then
    select cm.course_id into v_course_id
    from public.course_modules cm
    where cm.id = old.module_id;
  end if;

  select exists (
    select 1
    from public.program_enrollments pe
    join public.courses c on c.program_id = pe.program_id
    where c.id = v_course_id
  ) into v_enrollment_exists;

  if v_enrollment_exists then
    raise exception 'Cannot delete course content after a learner has been enrolled. Edit the content instead to preserve learner history.'
      using errcode = '42501';
  end if;

  return old;
end;
$$;

drop trigger if exists prevent_course_module_delete_with_enrollment on public.course_modules;
create trigger prevent_course_module_delete_with_enrollment
before delete on public.course_modules
for each row execute function public.prevent_enrolled_content_delete();

drop trigger if exists prevent_course_lesson_delete_with_enrollment on public.course_lessons;
create trigger prevent_course_lesson_delete_with_enrollment
before delete on public.course_lessons
for each row execute function public.prevent_enrolled_content_delete();

revoke all on function public.prevent_enrolled_content_delete() from public, anon, authenticated;
