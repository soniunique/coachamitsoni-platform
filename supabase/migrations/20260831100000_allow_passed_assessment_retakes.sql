CREATE OR REPLACE FUNCTION public.start_course_assessment(p_assessment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare a public.course_assessments%rowtype; v_course_id uuid; v_program_id uuid; v_total integer:=0; v_done integer:=0; v_attempts integer:=0; v_attempt_no integer:=1; v_started timestamptz:=now(); v_expires timestamptz; v_snapshot jsonb; v_session public.assessment_sessions%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into a from public.course_assessments where id=p_assessment_id; if a.id is null then raise exception 'Assessment not found'; end if;
 select c.id,c.program_id into v_course_id,v_program_id from public.courses c where c.id=a.course_id and c.status='published' and c.assessment_enabled; if v_course_id is null then raise exception 'Assessment is disabled'; end if;
 if not public.is_admin() and not exists(select 1 from public.program_enrollments pe where pe.user_id=auth.uid() and pe.program_id=v_program_id and pe.status in ('active','completed')) then raise exception 'You are not enrolled in this program'; end if;
 select count(*)::integer into v_total from public.course_lessons cl join public.course_modules cm on cm.id=cl.module_id where cm.course_id=v_course_id;
 if v_total>0 then select count(*)::integer into v_done from public.lesson_progress lp join public.course_lessons cl on cl.id=lp.lesson_id join public.course_modules cm on cm.id=cl.module_id where lp.user_id=auth.uid() and cm.course_id=v_course_id and lp.completed is true; end if;
 if a.require_completion and not public.is_admin() and v_total>0 and v_done<v_total then raise exception 'Complete all course lessons before starting the assessment'; end if;
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
end; $function$;
