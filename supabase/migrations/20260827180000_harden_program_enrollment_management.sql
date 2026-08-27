drop function if exists public.admin_set_program_enrollment(uuid,uuid,boolean);
create function public.admin_set_program_enrollment(p_program_id uuid, p_user_id uuid, p_enrolled boolean)
returns public.program_enrollments
language plpgsql
security definer
set search_path = public
as $$
declare result public.program_enrollments;
begin
  if not public.is_admin() then raise exception 'Only admins can manage program access'; end if;
  if not exists (select 1 from public.programs where id=p_program_id) then raise exception 'Program not found'; end if;
  if not exists (select 1 from public.profiles where id=p_user_id and role='student') then raise exception 'Only student users can be assigned to programs'; end if;
  if p_enrolled then
    insert into public.program_enrollments(user_id,program_id,status,enrolled_at,completed_at)
    values(p_user_id,p_program_id,'active',now(),null)
    on conflict(user_id,program_id) do update set status='active', enrolled_at=case when public.program_enrollments.status='cancelled' then now() else public.program_enrollments.enrolled_at end, completed_at=null
    returning * into result;
  else
    update public.program_enrollments set status='cancelled', completed_at=null
    where user_id=p_user_id and program_id=p_program_id and status <> 'cancelled'
    returning * into result;
    if result.id is null then raise exception 'Active program enrolment not found'; end if;
  end if;
  return result;
end;
$$;
revoke all on function public.admin_set_program_enrollment(uuid,uuid,boolean) from public;
grant execute on function public.admin_set_program_enrollment(uuid,uuid,boolean) to authenticated;

drop policy if exists programs_admin_all on public.programs;
create policy programs_admin_all on public.programs for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists programs_enrolled_read on public.programs;
create policy programs_enrolled_read on public.programs for select to authenticated using (public.is_program_enrolled(id));

drop policy if exists program_enrollments_admin_all on public.program_enrollments;
create policy program_enrollments_admin_all on public.program_enrollments for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists program_enrollments_own on public.program_enrollments;
create policy program_enrollments_own on public.program_enrollments for select to authenticated using (user_id=auth.uid());

drop policy if exists courses_admin_all on public.courses;
create policy courses_admin_all on public.courses for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists courses_program_enrolled_read on public.courses;
create policy courses_program_enrolled_read on public.courses for select to authenticated using (status='published' and public.is_program_enrolled(program_id));

drop policy if exists modules_admin_all on public.course_modules;
create policy modules_admin_all on public.course_modules for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists modules_program_enrolled_read on public.course_modules;
create policy modules_program_enrolled_read on public.course_modules for select to authenticated using (exists (select 1 from public.courses c where c.id=course_modules.course_id and c.status='published' and public.is_program_enrolled(c.program_id)));

drop policy if exists lessons_admin_all on public.course_lessons;
create policy lessons_admin_all on public.course_lessons for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists lessons_program_enrolled_read on public.course_lessons;
create policy lessons_program_enrolled_read on public.course_lessons for select to authenticated using (exists (select 1 from public.course_modules m join public.courses c on c.id=m.course_id where m.id=course_lessons.module_id and c.status='published' and public.is_program_enrolled(c.program_id)));

drop policy if exists enrollments_admin_all on public.enrollments;
create policy enrollments_admin_all on public.enrollments for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists enrollments_own_read on public.enrollments;
create policy enrollments_own_read on public.enrollments for select to authenticated using (user_id=auth.uid());

drop policy if exists lesson_progress_own_read on public.lesson_progress;
drop policy if exists lesson_progress_own_insert on public.lesson_progress;
drop policy if exists lesson_progress_own_update on public.lesson_progress;
drop policy if exists lesson_progress_own_delete on public.lesson_progress;
create policy lesson_progress_own_read on public.lesson_progress for select to authenticated using (user_id=auth.uid() and exists (select 1 from public.course_lessons l join public.course_modules m on m.id=l.module_id join public.courses c on c.id=m.course_id where l.id=lesson_progress.lesson_id and c.status='published' and public.is_program_enrolled(c.program_id)));
create policy lesson_progress_own_insert on public.lesson_progress for insert to authenticated with check (user_id=auth.uid() and exists (select 1 from public.course_lessons l join public.course_modules m on m.id=l.module_id join public.courses c on c.id=m.course_id where l.id=lesson_progress.lesson_id and c.status='published' and public.is_program_enrolled(c.program_id)));
create policy lesson_progress_own_update on public.lesson_progress for update to authenticated using (user_id=auth.uid() and exists (select 1 from public.course_lessons l join public.course_modules m on m.id=l.module_id join public.courses c on c.id=m.course_id where l.id=lesson_progress.lesson_id and c.status='published' and public.is_program_enrolled(c.program_id))) with check (user_id=auth.uid() and exists (select 1 from public.course_lessons l join public.course_modules m on m.id=l.module_id join public.courses c on c.id=m.course_id where l.id=lesson_progress.lesson_id and c.status='published' and public.is_program_enrolled(c.program_id)));
create policy lesson_progress_own_delete on public.lesson_progress for delete to authenticated using (user_id=auth.uid() and exists (select 1 from public.course_lessons l join public.course_modules m on m.id=l.module_id join public.courses c on c.id=m.course_id where l.id=lesson_progress.lesson_id and c.status='published' and public.is_program_enrolled(c.program_id)));
