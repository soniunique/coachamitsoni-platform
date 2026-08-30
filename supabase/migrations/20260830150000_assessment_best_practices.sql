drop function if exists public.submit_course_assessment(uuid,jsonb);

alter table public.course_assessments
  add column if not exists question_count integer,
  add column if not exists time_limit_minutes integer,
  add column if not exists randomize_questions boolean not null default true,
  add column if not exists randomize_options boolean not null default true,
  add column if not exists feedback_mode text not null default 'score_only',
  add column if not exists require_completion boolean not null default true,
  add column if not exists integrity_ack_required boolean not null default true;

alter table public.assessment_questions add column if not exists explanation text;

do $$ begin alter table public.course_assessments add constraint course_assessments_question_count_chk check (question_count is null or question_count > 0); exception when duplicate_object then null; end $$;
do $$ begin alter table public.course_assessments add constraint course_assessments_time_limit_chk check (time_limit_minutes is null or time_limit_minutes > 0); exception when duplicate_object then null; end $$;
do $$ begin alter table public.course_assessments add constraint course_assessments_feedback_mode_chk check (feedback_mode in ('score_only','incorrect_only','full_review')); exception when duplicate_object then null; end $$;

create table if not exists public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.course_assessments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_number integer not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  submitted_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','expired')),
  question_snapshot jsonb not null default '[]'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists assessment_sessions_active_unique on public.assessment_sessions(assessment_id,user_id) where status='in_progress';
create index if not exists assessment_sessions_user_idx on public.assessment_sessions(user_id,assessment_id,created_at desc);
alter table public.assessment_sessions enable row level security;
revoke all on public.assessment_sessions from anon, authenticated;

create or replace function public.get_student_assessment(p_course_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.course_assessments%rowtype; v_program_id uuid; v_total integer:=0; v_done integer:=0; v_completion numeric:=100; v_latest jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select c.program_id into v_program_id from public.courses c where c.id=p_course_id and c.status='published';
 if v_program_id is null then raise exception 'Course not found'; end if;
 if not public.is_admin() and not exists(select 1 from public.program_enrollments pe where pe.user_id=auth.uid() and pe.program_id=v_program_id and pe.status in ('active','completed')) then raise exception 'You are not enrolled in this program'; end if;
 select * into a from public.course_assessments where course_id=p_course_id and exists(select 1 from public.courses c where c.id=p_course_id and c.assessment_enabled);
 if a.id is null then return jsonb_build_object('enabled',false); end if;
 select count(*)::integer into v_total from public.course_lessons cl join public.course_modules cm on cm.id=cl.module_id where cm.course_id=p_course_id;
 if v_total>0 then select count(*)::integer into v_done from public.lesson_progress lp join public.course_lessons cl on cl.id=lp.lesson_id join public.course_modules cm on cm.id=cl.module_id where lp.user_id=auth.uid() and cm.course_id=p_course_id and lp.completed is true; v_completion:=round((v_done::numeric*100)/v_total,2); end if;
 select jsonb_build_object('score',aa.score,'passed',aa.passed,'attempt_number',aa.attempt_number,'submitted_at',aa.submitted_at) into v_latest from public.assessment_attempts aa where aa.assessment_id=a.id and aa.user_id=auth.uid() order by aa.submitted_at desc limit 1;
 return jsonb_build_object('enabled',true,'assessment',jsonb_build_object('id',a.id,'course_id',a.course_id,'title',a.title,'instructions',a.instructions,'passing_percentage',a.passing_percentage,'max_attempts',a.max_attempts,'question_count',a.question_count,'time_limit_minutes',a.time_limit_minutes,'randomize_questions',a.randomize_questions,'randomize_options',a.randomize_options,'feedback_mode',a.feedback_mode,'require_completion',a.require_completion,'integrity_ack_required',a.integrity_ack_required),'completion',jsonb_build_object('lessons_total',v_total,'lessons_completed',v_done,'percentage',v_completion,'can_start',public.is_admin() or not a.require_completion or v_total=0 or v_completion>=100),'latest_attempt',coalesce(v_latest,'null'::jsonb));
end; $$;

create or replace function public.start_course_assessment(p_assessment_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.course_assessments%rowtype; v_course_id uuid; v_program_id uuid; v_total integer:=0; v_done integer:=0; v_attempts integer:=0; v_attempt_no integer:=1; v_started timestamptz:=now(); v_expires timestamptz; v_snapshot jsonb; v_session public.assessment_sessions%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into a from public.course_assessments where id=p_assessment_id; if a.id is null then raise exception 'Assessment not found'; end if;
 select c.id,c.program_id into v_course_id,v_program_id from public.courses c where c.id=a.course_id and c.status='published' and c.assessment_enabled; if v_course_id is null then raise exception 'Assessment is disabled'; end if;
 if not public.is_admin() and not exists(select 1 from public.program_enrollments pe where pe.user_id=auth.uid() and pe.program_id=v_program_id and pe.status in ('active','completed')) then raise exception 'You are not enrolled in this program'; end if;
 select count(*)::integer into v_total from public.course_lessons cl join public.course_modules cm on cm.id=cl.module_id where cm.course_id=v_course_id;
 if v_total>0 then select count(*)::integer into v_done from public.lesson_progress lp join public.course_lessons cl on cl.id=lp.lesson_id join public.course_modules cm on cm.id=cl.module_id where lp.user_id=auth.uid() and cm.course_id=v_course_id and lp.completed is true; end if;
 if a.require_completion and not public.is_admin() and v_total>0 and v_done<v_total then raise exception 'Complete all course lessons before starting the assessment'; end if;
 if exists(select 1 from public.assessment_attempts where assessment_id=a.id and user_id=auth.uid() and passed) then return jsonb_build_object('already_passed',true,'passing_percentage',a.passing_percentage); end if;
 update public.assessment_sessions set status='expired',submitted_at=coalesce(submitted_at,now()) where assessment_id=a.id and user_id=auth.uid() and status='in_progress' and expires_at is not null and expires_at<=now();
 select * into v_session from public.assessment_sessions where assessment_id=a.id and user_id=auth.uid() and status='in_progress' order by created_at desc limit 1;
 if v_session.id is not null then return jsonb_build_object('session_id',v_session.id,'attempt_number',v_session.attempt_number,'started_at',v_session.started_at,'expires_at',v_session.expires_at,'time_limit_minutes',a.time_limit_minutes,'assessment',jsonb_build_object('id',a.id,'title',a.title,'passing_percentage',a.passing_percentage,'feedback_mode',a.feedback_mode),'questions',v_session.question_snapshot,'resumed',true); end if;
 select count(*)::integer into v_attempts from public.assessment_attempts where assessment_id=a.id and user_id=auth.uid();
 select v_attempts+count(*)::integer into v_attempts from public.assessment_sessions where assessment_id=a.id and user_id=auth.uid() and status='expired';
 if a.max_attempts is not null and v_attempts>=a.max_attempts then raise exception 'Maximum assessment attempts reached'; end if;
 v_attempt_no:=v_attempts+1; if a.time_limit_minutes is not null and a.time_limit_minutes>0 then v_expires:=v_started+make_interval(mins=>a.time_limit_minutes); end if;
 with selected as (select q.*,row_number() over(order by case when a.randomize_questions then random() else q.sort_order::double precision end) rn from public.assessment_questions q where q.assessment_id=a.id), picked as (select * from selected where a.question_count is null or a.question_count<=0 or rn<=a.question_count)
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'prompt',p.prompt,'points',p.points,'sort_order',p.rn,'options',(select coalesce(jsonb_agg(jsonb_build_object('id',x.value->>'id','text',x.value->>'text') order by case when a.randomize_options then random() else x.ordinality end),'[]'::jsonb) from jsonb_array_elements(p.options) with ordinality x(value,ordinality))) order by p.rn),'[]'::jsonb) into v_snapshot from picked p;
 if jsonb_array_length(v_snapshot)=0 then raise exception 'Assessment has no questions'; end if;
 insert into public.assessment_sessions(assessment_id,user_id,attempt_number,started_at,expires_at,question_snapshot) values(a.id,auth.uid(),v_attempt_no,v_started,v_expires,v_snapshot) returning * into v_session;
 return jsonb_build_object('session_id',v_session.id,'attempt_number',v_session.attempt_number,'started_at',v_session.started_at,'expires_at',v_session.expires_at,'time_limit_minutes',a.time_limit_minutes,'assessment',jsonb_build_object('id',a.id,'title',a.title,'passing_percentage',a.passing_percentage,'feedback_mode',a.feedback_mode),'questions',v_snapshot,'resumed',false);
end; $$;

create or replace function public.submit_course_assessment(p_session_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.assessment_sessions%rowtype; a public.course_assessments%rowtype; q record; v_score numeric:=0; v_total numeric:=0; v_earned numeric:=0; v_answer text; v_timed_out boolean:=false; v_review jsonb:='[]'::jsonb; v_passed boolean;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(coalesce(p_answers,'{}'::jsonb))<>'object' then raise exception 'Answers must be an object'; end if;
 select * into s from public.assessment_sessions where id=p_session_id and user_id=auth.uid(); if s.id is null then raise exception 'Assessment session not found'; end if;
 if s.status<>'in_progress' then raise exception 'Assessment session is no longer active'; end if;
 select * into a from public.course_assessments where id=s.assessment_id; if a.id is null then raise exception 'Assessment not found'; end if;
 v_timed_out:=s.expires_at is not null and now()>s.expires_at;
 for q in select aq.id,aq.correct_option,aq.points,aq.explanation from public.assessment_questions aq where aq.assessment_id=a.id and aq.id in(select (x->>'id')::uuid from jsonb_array_elements(s.question_snapshot) x) loop
  v_total:=v_total+q.points; v_answer:=p_answers->>q.id::text; if v_answer is not null and v_answer=q.correct_option then v_earned:=v_earned+q.points; end if;
  if a.feedback_mode<>'score_only' then v_review:=v_review||jsonb_build_array(jsonb_build_object('question_id',q.id,'correct',v_answer is not null and v_answer=q.correct_option,'selected_option',v_answer,'correct_option',case when a.feedback_mode='full_review' then q.correct_option else null end,'explanation',case when a.feedback_mode='full_review' then q.explanation else null end)); end if;
 end loop;
 if v_total>0 then v_score:=round((v_earned/v_total)*100,2); end if; v_passed:=v_score>=a.passing_percentage;
 update public.assessment_sessions set status='submitted',submitted_at=now(),answers=p_answers where id=s.id;
 insert into public.assessment_attempts(assessment_id,user_id,attempt_number,score,passed,answers) values(a.id,auth.uid(),s.attempt_number,v_score,v_passed,p_answers);
 return jsonb_build_object('attempt_number',s.attempt_number,'score',v_score,'passed',v_passed,'passing_percentage',a.passing_percentage,'timed_out',v_timed_out,'feedback',case when v_timed_out then 'Time expired; your answers were submitted automatically.' else null end,'review',v_review);
end; $$;

create or replace function public.get_assessment_analytics(p_assessment_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_attempts integer; v_passed integer; v_avg numeric;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access required'; end if;
 if not exists(select 1 from public.course_assessments where id=p_assessment_id) then raise exception 'Assessment not found'; end if;
 select count(*)::integer,count(*) filter(where passed)::integer,round(coalesce(avg(score),0),2) into v_attempts,v_passed,v_avg from public.assessment_attempts where assessment_id=p_assessment_id;
 return jsonb_build_object('attempts',v_attempts,'passed',v_passed,'pass_rate',case when v_attempts>0 then round((v_passed::numeric/v_attempts)*100,2) else 0 end,'average_score',v_avg);
end; $$;

revoke all on function public.get_student_assessment(uuid) from public,anon;
revoke all on function public.start_course_assessment(uuid) from public,anon;
revoke all on function public.submit_course_assessment(uuid,jsonb) from public,anon;
revoke all on function public.get_assessment_analytics(uuid) from public,anon;
grant execute on function public.get_student_assessment(uuid) to authenticated;
grant execute on function public.start_course_assessment(uuid) to authenticated;
grant execute on function public.submit_course_assessment(uuid,jsonb) to authenticated;
grant execute on function public.get_assessment_analytics(uuid) to authenticated;