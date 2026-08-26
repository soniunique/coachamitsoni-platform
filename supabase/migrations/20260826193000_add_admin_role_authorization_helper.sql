-- Admin role authorization helper used by admin-only enrolment RPCs.
-- Enrolment remains course-level: an active/completed course enrolment grants
-- access to all modules/lessons in that course; there is no module enrolment.
create or replace function public.is_admin()
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
      and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;
