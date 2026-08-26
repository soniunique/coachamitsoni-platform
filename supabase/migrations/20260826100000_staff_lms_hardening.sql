create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('coach', 'admin')
  );
$$;

-- Students may edit their profile details, but never their authorization role.
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, bio) on public.profiles to authenticated;

-- Recreate staff policies idempotently so this migration is safe even if the
-- policies were previously applied manually in the Supabase SQL editor.
drop policy if exists courses_staff_select on public.courses;
create policy courses_staff_select on public.courses for select to authenticated using (public.is_staff());
drop policy if exists courses_staff_insert on public.courses;
create policy courses_staff_insert on public.courses for insert to authenticated with check (public.is_staff());
drop policy if exists courses_staff_update on public.courses;
create policy courses_staff_update on public.courses for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists courses_staff_delete on public.courses;
create policy courses_staff_delete on public.courses for delete to authenticated using (public.is_staff());

drop policy if exists modules_staff_select on public.course_modules;
create policy modules_staff_select on public.course_modules for select to authenticated using (public.is_staff());
drop policy if exists modules_staff_insert on public.course_modules;
create policy modules_staff_insert on public.course_modules for insert to authenticated with check (public.is_staff());
drop policy if exists modules_staff_update on public.course_modules;
create policy modules_staff_update on public.course_modules for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists modules_staff_delete on public.course_modules;
create policy modules_staff_delete on public.course_modules for delete to authenticated using (public.is_staff());

drop policy if exists lessons_staff_select on public.course_lessons;
create policy lessons_staff_select on public.course_lessons for select to authenticated using (public.is_staff());
drop policy if exists lessons_staff_insert on public.course_lessons;
create policy lessons_staff_insert on public.course_lessons for insert to authenticated with check (public.is_staff());
drop policy if exists lessons_staff_update on public.course_lessons;
create policy lessons_staff_update on public.course_lessons for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists lessons_staff_delete on public.course_lessons;
create policy lessons_staff_delete on public.course_lessons for delete to authenticated using (public.is_staff());

drop policy if exists lessons_enrolled_read on public.course_lessons;
create policy lessons_enrolled_read on public.course_lessons for select to authenticated using (
  exists (
    select 1
    from public.course_modules m
    join public.courses c on c.id = m.course_id
    join public.enrollments e on e.course_id = c.id
    where m.id = course_lessons.module_id
      and e.user_id = auth.uid()
      and e.status in ('active', 'completed')
  )
);

-- Keep workshop administration restricted to staff.
drop policy if exists workshops_staff_select on public.workshops;
create policy workshops_staff_select on public.workshops for select to authenticated using (public.is_staff());
drop policy if exists workshops_staff_insert on public.workshops;
create policy workshops_staff_insert on public.workshops for insert to authenticated with check (public.is_staff());
drop policy if exists workshops_staff_update on public.workshops;
create policy workshops_staff_update on public.workshops for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists workshops_staff_delete on public.workshops;
create policy workshops_staff_delete on public.workshops for delete to authenticated using (public.is_staff());
