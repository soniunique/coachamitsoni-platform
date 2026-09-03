alter table public.courses add column if not exists assessment_enabled boolean not null default false;
alter table public.courses add column if not exists assessment_required boolean not null default false;

create table if not exists public.course_assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null default 'Course Assessment',
  instructions text,
  passing_percentage numeric(5,2) not null default 80 check (passing_percentage between 1 and 100),
  max_attempts integer check (max_attempts is null or max_attempts > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id)
);

create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.course_assessments(id) on delete cascade,
  prompt text not null,
  options jsonb not null,
  correct_option text not null,
  points integer not null default 1 check (points > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(assessment_id, sort_order),
  check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2)
);

create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.course_assessments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  score numeric(5,2) not null default 0 check (score between 0 and 100),
  passed boolean not null default false,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  unique(assessment_id, user_id, attempt_number)
);

create index if not exists assessment_questions_assessment_order_idx on public.assessment_questions(assessment_id, sort_order);
create index if not exists assessment_attempts_user_assessment_idx on public.assessment_attempts(user_id, assessment_id, submitted_at desc);

drop trigger if exists course_assessments_updated_at on public.course_assessments;
create trigger course_assessments_updated_at before update on public.course_assessments for each row execute function public.set_updated_at();
drop trigger if exists assessment_questions_updated_at on public.assessment_questions;
create trigger assessment_questions_updated_at before update on public.assessment_questions for each row execute function public.set_updated_at();

alter table public.course_assessments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_attempts enable row level security;

drop policy if exists course_assessments_admin_all on public.course_assessments;
create policy course_assessments_admin_all on public.course_assessments for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists assessment_questions_admin_all on public.assessment_questions;
create policy assessment_questions_admin_all on public.assessment_questions for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists assessment_attempts_admin_all on public.assessment_attempts;
create policy assessment_attempts_admin_all on public.assessment_attempts for select to authenticated using(public.is_admin());
drop policy if exists assessment_attempts_own_select on public.assessment_attempts;
create policy assessment_attempts_own_select on public.assessment_attempts for select to authenticated using(user_id=auth.uid());

create or replace function public.get_student_assessment(p_course_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_assessment public.course_assessments%rowtype; v_program_id uuid; v_questions jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select c.program_id into v_program_id from public.courses c where c.id=p_course_id and c.status='published';
  if v_program_id is null then raise exception 'Course not found'; end if;
  if not public.is_admin() and not exists (select 1 from public.program_enrollments pe where pe.user_id=auth.uid() and pe.program_id=v_program_id and pe.status in ('active','completed')) then raise exception 'You are not enrolled in this program'; end if;
  select * into v_assessment from public.course_assessments where course_id=p_course_id and exists (select 1 from public.courses c where c.id=p_course_id and c.assessment_enabled);
  if v_assessment.id is null then return jsonb_build_object('enabled',false); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'prompt',q.prompt,'options',q.options,'points',q.points,'sort_order',q.sort_order) order by q.sort_order), '[]'::jsonb) into v_questions from public.assessment_questions q where q.assessment_id=v_assessment.id;
  return jsonb_build_object('enabled',true,'assessment',jsonb_build_object('id',v_assessment.id,'course_id',v_assessment.course_id,'title',v_assessment.title,'instructions',v_assessment.instructions,'passing_percentage',v_assessment.passing_percentage,'max_attempts',v_assessment.max_attempts),'questions',v_questions);
end; $$;

-- A legacy migration created the same signature with a different parameter
-- name. PostgreSQL does not permit CREATE OR REPLACE to rename input params.
drop function if exists public.submit_course_assessment(uuid, jsonb);
create function public.submit_course_assessment(p_assessment_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.course_assessments%rowtype; q record; v_course_id uuid; v_program_id uuid; v_attempts integer; v_attempt_no integer; v_total_points numeric := 0; v_earned_points numeric := 0; v_score numeric := 0; v_passed boolean := false; v_answer text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(coalesce(p_answers,'{}'::jsonb)) <> 'object' then raise exception 'Answers must be an object'; end if;
  select * into a from public.course_assessments where id=p_assessment_id;
  if a.id is null then raise exception 'Assessment not found'; end if;
  select c.id,c.program_id into v_course_id,v_program_id from public.courses c where c.id=a.course_id and c.assessment_enabled;
  if v_course_id is null then raise exception 'Assessment is disabled'; end if;
  if not public.is_admin() and not exists (select 1 from public.program_enrollments pe where pe.user_id=auth.uid() and pe.program_id=v_program_id and pe.status in ('active','completed')) then raise exception 'You are not enrolled in this program'; end if;
  select count(*)::integer into v_attempts from public.assessment_attempts where assessment_id=a.id and user_id=auth.uid();
  if a.max_attempts is not null and v_attempts >= a.max_attempts then raise exception 'Maximum assessment attempts reached'; end if;
  v_attempt_no := v_attempts + 1;
  for q in select id,correct_option,points from public.assessment_questions where assessment_id=a.id loop
    v_total_points := v_total_points + q.points;
    v_answer := p_answers->>q.id::text;
    if v_answer is not null and v_answer = q.correct_option then v_earned_points := v_earned_points + q.points; end if;
  end loop;
  if v_total_points > 0 then v_score := round((v_earned_points / v_total_points) * 100, 2); end if;
  v_passed := v_score >= a.passing_percentage;
  insert into public.assessment_attempts(assessment_id,user_id,attempt_number,score,passed,answers) values(a.id,auth.uid(),v_attempt_no,v_score,v_passed,p_answers);
  return jsonb_build_object('attempt_number',v_attempt_no,'score',v_score,'passed',v_passed,'passing_percentage',a.passing_percentage);
end; $$;

revoke all on function public.get_student_assessment(uuid) from public;
grant execute on function public.get_student_assessment(uuid) to authenticated;
revoke all on function public.submit_course_assessment(uuid,jsonb) from public;
grant execute on function public.submit_course_assessment(uuid,jsonb) to authenticated;
