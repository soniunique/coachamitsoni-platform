-- Keep the admin roster progress in sync with the authoritative lesson_progress rows.
-- Course completion remains course-level; there is no module-level enrolment.

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
    case
      when e.id is null or e.status = 'cancelled' then null
      when totals.total_lessons = 0 then 0::numeric
      else round((completed.completed_lessons::numeric * 100) / totals.total_lessons, 2)
    end,
    e.enrolled_at,
    case
      when e.status = 'completed' then e.completed_at
      when totals.total_lessons > 0 and completed.completed_lessons = totals.total_lessons then completed.latest_completed_at
      else null
    end
  from auth.users u
  join public.profiles p on p.id = u.id
  left join public.enrollments e
    on e.user_id = u.id
   and e.course_id = p_course_id
  left join lateral (
    select count(*)::integer as total_lessons
    from public.course_lessons l
    join public.course_modules m on m.id = l.module_id
    where m.course_id = p_course_id
  ) totals on true
  left join lateral (
    select
      count(*) filter (where lp.completed)::integer as completed_lessons,
      max(lp.completed_at) filter (where lp.completed) as latest_completed_at
    from public.course_lessons l
    join public.course_modules m on m.id = l.module_id
    left join public.lesson_progress lp
      on lp.lesson_id = l.id
     and lp.user_id = u.id
    where m.course_id = p_course_id
  ) completed on true
  where p.role = 'student'
  order by
    case when e.status in ('active', 'completed') then 0 else 1 end,
    lower(coalesce(p.full_name, '')),
    lower(coalesce(u.email, ''));
end;
$$;

grant execute on function public.admin_get_course_roster(uuid) to authenticated;

-- Administrators are course managers and therefore have full read access to
-- published courses/lessons without needing a student enrolment.
drop policy if exists courses_admin_read on public.courses;
create policy courses_admin_read
on public.courses
for select to authenticated
using (public.is_admin());

drop policy if exists modules_admin_read on public.course_modules;
create policy modules_admin_read
on public.course_modules
for select to authenticated
using (public.is_admin());

drop policy if exists lessons_admin_read on public.course_lessons;
create policy lessons_admin_read
on public.course_lessons
for select to authenticated
using (public.is_admin());

-- Keep enrolment progress fields aligned for future consumers as well.
create or replace function public.sync_course_enrollment_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_course uuid;
  target_user uuid;
  total_lessons integer;
  completed_lessons integer;
  next_progress numeric(5,2);
begin
  target_user := coalesce(new.user_id, old.user_id);
  select m.course_id into target_course
  from public.course_lessons l
  join public.course_modules m on m.id = l.module_id
  where l.id = coalesce(new.lesson_id, old.lesson_id);

  if target_course is null then
    return coalesce(new, old);
  end if;

  select count(*)::integer into total_lessons
  from public.course_lessons l
  join public.course_modules m on m.id = l.module_id
  where m.course_id = target_course;

  select count(*) filter (where lp.completed)::integer into completed_lessons
  from public.course_lessons l
  join public.course_modules m on m.id = l.module_id
  left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = target_user
  where m.course_id = target_course;

  next_progress := case when total_lessons = 0 then 0 else round((completed_lessons::numeric * 100) / total_lessons, 2) end;

  update public.enrollments
     set progress_percent = next_progress,
         status = case when status = 'cancelled' then status
                       when next_progress = 100 then 'completed'
                       else 'active' end,
         completed_at = case when next_progress = 100 then coalesce(completed_at, now()) else null end
   where user_id = target_user
     and course_id = target_course
     and status in ('active', 'completed');

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_course_enrollment_progress_trigger on public.lesson_progress;
create trigger sync_course_enrollment_progress_trigger
after insert or update or delete on public.lesson_progress
for each row execute function public.sync_course_enrollment_progress();

-- Backfill the denormalized enrollment progress for existing enrolments.
update public.enrollments e
set progress_percent = (
      select case
        when count(l.id) = 0 then 0::numeric
        else round((count(*) filter (where lp.completed)::numeric * 100) / count(l.id), 2)
      end
      from public.course_modules m
      join public.course_lessons l on l.module_id = m.id
      left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = e.user_id
      where m.course_id = e.course_id
    ),
    status = case
      when e.status = 'cancelled' then e.status
      when (
        select case
          when count(l.id) = 0 then 0::numeric
          else round((count(*) filter (where lp.completed)::numeric * 100) / count(l.id), 2)
        end
        from public.course_modules m
        join public.course_lessons l on l.module_id = m.id
        left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = e.user_id
        where m.course_id = e.course_id
      ) = 100 then 'completed'
      else 'active'
    end,
    completed_at = case
      when e.status = 'cancelled' then null
      when (
        select case
          when count(l.id) = 0 then 0::numeric
          else round((count(*) filter (where lp.completed)::numeric * 100) / count(l.id), 2)
        end
        from public.course_modules m
        join public.course_lessons l on l.module_id = m.id
        left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = e.user_id
        where m.course_id = e.course_id
      ) = 100 then coalesce(e.completed_at, now())
      else null
    end
where e.status in ('active', 'completed');
