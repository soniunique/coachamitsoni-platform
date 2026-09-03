create or replace function public.audit_admin_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_id uuid;
  v_label text;
  v_changed text[];
begin
  if not public.is_admin() then
    return coalesce(new, old);
  end if;

  v_row := to_jsonb(case when TG_OP = 'DELETE' then old else new end);
  v_id := nullif(v_row->>'id','')::uuid;
  v_label := coalesce(
    nullif(v_row->>'title',''),
    nullif(v_row->>'name',''),
    nullif(v_row->>'full_name',''),
    nullif(v_row->>'question_text',''),
    nullif(v_row->>'slug',''),
    TG_TABLE_NAME
  );

  if TG_OP = 'UPDATE' then
    select array_agg(key order by key)
      into v_changed
    from jsonb_object_keys(to_jsonb(new)) as key
    where to_jsonb(old)->key is distinct from to_jsonb(new)->key;
  end if;

  insert into public.admin_audit_log(
    admin_user_id, action, target_type, target_id, target_label, details
  ) values (
    auth.uid(),
    lower(TG_OP),
    TG_TABLE_NAME,
    v_id,
    v_label,
    case
      when TG_OP = 'UPDATE' then jsonb_build_object('operation', lower(TG_OP), 'changed_fields', coalesce(to_jsonb(v_changed), '[]'::jsonb))
      else jsonb_build_object('operation', lower(TG_OP))
    end
  );

  return coalesce(new, old);
end;
$$;

-- Audit only administrator mutations. Student activity such as lesson progress and assessment attempts is intentionally excluded.
drop trigger if exists audit_admin_profiles on public.profiles;
create trigger audit_admin_profiles after insert or update or delete on public.profiles for each row execute function public.audit_admin_mutation();
drop trigger if exists audit_admin_programs on public.programs;
create trigger audit_admin_programs after insert or update or delete on public.programs for each row execute function public.audit_admin_mutation();
drop trigger if exists audit_admin_courses on public.courses;
create trigger audit_admin_courses after insert or update or delete on public.courses for each row execute function public.audit_admin_mutation();
drop trigger if exists audit_admin_course_modules on public.course_modules;
create trigger audit_admin_course_modules after insert or update or delete on public.course_modules for each row execute function public.audit_admin_mutation();
drop trigger if exists audit_admin_course_lessons on public.course_lessons;
create trigger audit_admin_course_lessons after insert or update or delete on public.course_lessons for each row execute function public.audit_admin_mutation();
drop trigger if exists audit_admin_course_assessments on public.course_assessments;
create trigger audit_admin_course_assessments after insert or update or delete on public.course_assessments for each row execute function public.audit_admin_mutation();
drop trigger if exists audit_admin_assessment_questions on public.assessment_questions;
create trigger audit_admin_assessment_questions after insert or update or delete on public.assessment_questions for each row execute function public.audit_admin_mutation();
drop trigger if exists audit_admin_program_enrollments on public.program_enrollments;
create trigger audit_admin_program_enrollments after insert or update or delete on public.program_enrollments for each row execute function public.audit_admin_mutation();
drop trigger if exists audit_admin_enrollments on public.enrollments;
create trigger audit_admin_enrollments after insert or update or delete on public.enrollments for each row execute function public.audit_admin_mutation();
drop trigger if exists audit_admin_workshops on public.workshops;
create trigger audit_admin_workshops after insert or update or delete on public.workshops for each row execute function public.audit_admin_mutation();
drop trigger if exists audit_admin_workshop_registrations on public.workshop_registrations;
create trigger audit_admin_workshop_registrations after insert or update or delete on public.workshop_registrations for each row execute function public.audit_admin_mutation();

-- Announcements are provisioned separately in some environments, so keep the migration chain portable.
do $$
begin
  if to_regclass('public.announcements') is not null then
    execute 'drop trigger if exists audit_admin_announcements on public.announcements';
    execute 'create trigger audit_admin_announcements after insert or update or delete on public.announcements for each row execute function public.audit_admin_mutation()';
  end if;
end;
$$;
