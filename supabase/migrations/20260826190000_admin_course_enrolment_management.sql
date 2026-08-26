-- Admin-only course enrolment management.
-- The application has exactly two authorization roles: student and admin.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role = any (array['student'::text, 'admin'::text]));

create or replace function public.admin_list_students()
returns table (
  id uuid,
  email text,
  full_name text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can list students';
  end if;

  return query
  select u.id, u.email::text, coalesce(p.full_name, '')
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.role = 'student'
  order by lower(coalesce(p.full_name, '')), lower(coalesce(u.email, ''));
end;
$$;

grant execute on function public.admin_list_students() to authenticated;

create or replace function public.admin_get_course_roster(p_course_id uuid)
returns table (
  student_id uuid,
  email text,
  full_name text,
  enrollment_id uuid,
  enrollment_status text,
  progress_percent numeric,
  enrolled_at timestamptz,
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can view course enrolments';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(p.full_name, ''),
    e.id,
    e.status,
    e.progress_percent,
    e.enrolled_at,
    e.completed_at
  from auth.users u
  join public.profiles p on p.id = u.id
  left join public.enrollments e
    on e.user_id = u.id
   and e.course_id = p_course_id
  where p.role = 'student'
  order by
    case when e.status in ('active', 'completed') then 0 else 1 end,
    lower(coalesce(p.full_name, '')),
    lower(coalesce(u.email, ''));
end;
$$;

grant execute on function public.admin_get_course_roster(uuid) to authenticated;

create or replace function public.admin_enroll_student(p_course_id uuid, p_user_id uuid)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.enrollments;
begin
  if not public.is_admin() then
    raise exception 'Only admins can enrol students';
  end if;

  if not exists (select 1 from public.courses where id = p_course_id) then
    raise exception 'Course not found';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id and role = 'student') then
    raise exception 'Only student users can be enrolled';
  end if;

  insert into public.enrollments (user_id, course_id, status, progress_percent, enrolled_at, completed_at)
  values (p_user_id, p_course_id, 'active', 0, now(), null)
  on conflict (user_id, course_id) do update
    set status = 'active',
        progress_percent = case when public.enrollments.status = 'cancelled' then 0 else public.enrollments.progress_percent end,
        enrolled_at = case when public.enrollments.status = 'cancelled' then now() else public.enrollments.enrolled_at end,
        completed_at = case when public.enrollments.status = 'cancelled' then null else public.enrollments.completed_at end
  returning * into result;

  return result;
end;
$$;

grant execute on function public.admin_enroll_student(uuid, uuid) to authenticated;

create or replace function public.admin_unenroll_student(p_course_id uuid, p_user_id uuid)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.enrollments;
begin
  if not public.is_admin() then
    raise exception 'Only admins can unenrol students';
  end if;

  update public.enrollments
     set status = 'cancelled', completed_at = null
   where course_id = p_course_id
     and user_id = p_user_id
     and status <> 'cancelled'
  returning * into result;

  if result.id is null then
    raise exception 'Active enrolment not found';
  end if;

  return result;
end;
$$;

grant execute on function public.admin_unenroll_student(uuid, uuid) to authenticated;
