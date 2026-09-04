-- Keep course publishing aligned with the Admin readiness indicator.
-- A course must contain at least one module and one lesson. If the course
-- requires an assessment, the assessment configuration must exist as well.

create or replace function public.prevent_incomplete_course_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  module_count integer;
  lesson_count integer;
  assessment_exists boolean;
  assessment_required boolean;
begin
  if new.status <> 'published' or old.status = 'published' then
    return new;
  end if;

  select count(*) into module_count
  from public.course_modules
  where course_id = new.id;

  select count(*) into lesson_count
  from public.course_lessons l
  join public.course_modules m on m.id = l.module_id
  where m.course_id = new.id;

  select exists(
    select 1 from public.course_assessments a where a.course_id = new.id
  ) into assessment_exists;

  select (
    coalesce(new.assessment_required, false)
    or coalesce((select a.require_completion from public.course_assessments a where a.course_id = new.id limit 1), false)
  ) into assessment_required;

  if module_count = 0 or lesson_count = 0 or (assessment_required and not assessment_exists) then
    raise exception 'Course is not ready to publish. Add at least one module and one lesson; create the required assessment when configured.' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_incomplete_course_publish() from public, anon, authenticated;
grant execute on function public.prevent_incomplete_course_publish() to service_role;

drop trigger if exists prevent_incomplete_course_publish on public.courses;
create trigger prevent_incomplete_course_publish
before update of status on public.courses
for each row
execute function public.prevent_incomplete_course_publish();
