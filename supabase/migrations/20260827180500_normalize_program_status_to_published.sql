update public.programs set status='published', updated_at=now() where status='active';

alter table public.programs drop constraint if exists programs_status_check;
alter table public.programs add constraint programs_status_check check (status = any (array['draft'::text,'published'::text,'archived'::text]));
