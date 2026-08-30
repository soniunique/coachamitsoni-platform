revoke execute on function public.get_student_assessment(uuid) from public, anon;
grant execute on function public.get_student_assessment(uuid) to authenticated;
revoke execute on function public.submit_course_assessment(uuid, jsonb) from public, anon;
grant execute on function public.submit_course_assessment(uuid, jsonb) to authenticated;
