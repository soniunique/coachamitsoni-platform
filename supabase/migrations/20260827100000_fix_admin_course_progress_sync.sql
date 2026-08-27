create or replace function public.admin_get_course_roster(p_course_id uuid)
returns table(
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
  with course_lessons as (
    select cl.id
    from public.course_lessons cl
    join public.course_modules cm on cm.id = cl.module_id
    where cm.course_id = p_course_id
  ),
  progress as (
    select lp.user_id,
           count(*) filter (where lp.completed)::numeric as completed_lessons
    from public.lesson_progress lp
    join course_lessons cl on cl.id = lp.lesson_id
    group by lp.user_id
  ),
  lesson_count as (
    select count(*)::numeric as total_lessons from course_lessons
  )
  select
    u.id,
    u.email::text,
    coalesce(p.full_name, ''),
    e.id,
    e.status,
    case
      when coalesce(lc.total_lessons, 0) = 0 then 0::numeric
      else round((coalesce(pr.completed_lessons, 0) / lc.total_lessons) * 100, 2)
    end as progress_percent,
    e.enrolled_at,
    case
      when coalesce(lc.total_lessons, 0) > 0
       and coalesce(pr.completed_lessons, 0) >= lc.total_lessons
       and e.status in ('active', 'completed')
      then coalesce(e.completed_at, now())
      else e.completed_at
    end as completed_at
  from auth.users u
  join public.profiles p on p.id = u.id
  left join public.enrollments e
    on e.user_id = u.id and e.course_id = p_course_id
  cross join lesson_count lc
  left join progress pr on pr.user_id = u.id
  where p.role = 'student'
  order by
    case when e.status in ('active', 'completed') then 0 else 1 end,
    lower(coalesce(p.full_name, '')),
    lower(coalesce(u.email, ''));
end;
$$;
