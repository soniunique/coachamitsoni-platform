-- Course metadata used by the reference catalogue filters.
alter table public.courses
  add column if not exists access_type text not null default 'free'
    check (access_type in ('free','paid','service')),
  add column if not exists duration_minutes integer
    check (duration_minutes is null or duration_minutes > 0);

create index if not exists courses_access_type_idx on public.courses(access_type);
