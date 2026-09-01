alter table public.course_assessments alter column max_attempts set default 3;

update public.course_assessments
set max_attempts = 3
where max_attempts is null or max_attempts <> 3;
