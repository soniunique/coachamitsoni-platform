create or replace function public.issue_course_certificate_if_complete()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_course_id uuid;
  v_program_id uuid;
  v_total integer;
  v_done integer;
  v_progress numeric;
  v_assessment_required boolean := false;
  v_assessment_id uuid;
begin
  if new.completed is not true then return new; end if;

  select cm.course_id, c.program_id, c.assessment_required
    into v_course_id, v_program_id, v_assessment_required
  from public.course_lessons cl
  join public.course_modules cm on cm.id = cl.module_id
  join public.courses c on c.id = cm.course_id
  where cl.id = new.lesson_id;

  if v_course_id is null or v_program_id is null then return new; end if;

  if not exists (
    select 1 from public.program_enrollments pe
    where pe.user_id = new.user_id
      and pe.program_id = v_program_id
      and pe.status in ('active','completed')
  ) then return new; end if;

  select count(*)::integer into v_total
  from public.course_lessons cl
  join public.course_modules cm on cm.id = cl.module_id
  where cm.course_id = v_course_id;

  if v_total = 0 then return new; end if;

  select count(*)::integer into v_done
  from public.lesson_progress lp
  join public.course_lessons cl on cl.id = lp.lesson_id
  join public.course_modules cm on cm.id = cl.module_id
  where lp.user_id = new.user_id
    and cm.course_id = v_course_id
    and lp.completed is true;

  v_progress := round((v_done::numeric * 100) / v_total, 2);
  if v_progress < 80 then return new; end if;

  if v_assessment_required then
    select ca.id into v_assessment_id
    from public.course_assessments ca
    where ca.course_id = v_course_id;
    if v_assessment_id is null then return new; end if;
    if not exists (
      select 1 from public.assessment_attempts aa
      where aa.assessment_id = v_assessment_id
        and aa.user_id = new.user_id
        and aa.passed is true
    ) then return new; end if;
  end if;

  insert into public.course_certificates (user_id, course_id, certificate_number)
  values (
    new.user_id,
    v_course_id,
    'CAS-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  )
  on conflict (user_id, course_id) do nothing;

  return new;
end;
$$;
