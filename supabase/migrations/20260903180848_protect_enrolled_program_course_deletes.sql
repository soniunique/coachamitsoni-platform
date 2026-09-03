-- Protect learner history and access when an Admin manages programs/courses.
-- Programs cannot be deleted while enrollment records exist, and courses cannot
-- be deleted while their parent program has enrollment records. Admins should
-- archive content instead when it has learner history.

alter table public.program_enrollments
  drop constraint if exists program_enrollments_program_id_fkey;

alter table public.program_enrollments
  add constraint program_enrollments_program_id_fkey
  foreign key (program_id)
  references public.programs(id)
  on delete restrict;

create or replace function public.prevent_course_delete_with_program_enrollments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.program_enrollments pe
    where pe.program_id = old.program_id
      and pe.status in ('active', 'completed', 'refund_pending', 'refunded')
  ) then
    raise exception 'Cannot delete course while its program has enrollment records. Archive the course instead.'
      using errcode = '23503';
  end if;

  return old;
end;
$$;

revoke all on function public.prevent_course_delete_with_program_enrollments() from public, anon, authenticated;
grant execute on function public.prevent_course_delete_with_program_enrollments() to service_role;

drop trigger if exists prevent_course_delete_with_program_enrollments on public.courses;

create trigger prevent_course_delete_with_program_enrollments
before delete on public.courses
for each row
execute function public.prevent_course_delete_with_program_enrollments();
