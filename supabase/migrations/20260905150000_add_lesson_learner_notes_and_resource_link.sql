alter table public.course_lessons
  add column if not exists learner_notes text,
  add column if not exists learner_resource_url text;
