-- Students may only read their own certificate when they remain enrolled
-- in that course and have completed at least 80% of it.
alter table public.course_certificates enable row level security;

drop policy if exists course_certificates_own_read on public.course_certificates;

create policy course_certificates_own_read
on public.course_certificates
for select to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.enrollments e
    where e.user_id = auth.uid()
      and e.course_id = course_certificates.course_id
      and e.status in ('active', 'completed')
      and e.progress_percent >= 80
  )
);
