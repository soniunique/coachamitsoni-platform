-- Phase 2 security hardening: Student/Admin only. Keep grants aligned with actual client operations.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Public read-only surfaces.
grant select on table public.courses to anon;
grant select on table public.programs to anon;
grant select on table public.workshops to anon;

-- Signed-in application access. RLS remains the row-level authorization boundary.
grant select on table public.admin_audit_log to authenticated;
grant select, insert, update, delete on table public.announcements to authenticated;
grant select on table public.assessment_attempts to authenticated;
grant select, insert, update, delete on table public.assessment_questions to authenticated;
grant select, insert, update, delete on table public.chatroom_message_reads to authenticated;
grant select, insert, update on table public.chatroom_messages to authenticated;
grant select, insert, update, delete on table public.chatrooms to authenticated;
grant select, insert on table public.conversation_members to authenticated;
grant select, insert on table public.conversations to authenticated;
grant select, insert, update, delete on table public.course_assessments to authenticated;
grant select on table public.course_certificates to authenticated;
grant select, insert, update, delete on table public.course_lessons to authenticated;
grant select, insert, update, delete on table public.course_modules to authenticated;
grant select, insert, update, delete on table public.courses to authenticated;
grant select, insert, update, delete on table public.discussion_replies to authenticated;
grant select, insert, update, delete on table public.discussion_threads to authenticated;
grant select, insert, update, delete on table public.enrollments to authenticated;
grant select on table public.feed_posts to authenticated;
grant select, insert, update, delete on table public.lesson_progress to authenticated;
grant select, insert, update on table public.messages to authenticated;
grant select, insert, update, delete on table public.notifications to authenticated;
grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.program_enrollments to authenticated;
grant select, insert, update, delete on table public.program_orders to authenticated;
grant select, insert, update, delete on table public.programs to authenticated;
grant select, insert, update, delete on table public.workshop_registrations to authenticated;
grant select, insert, update, delete on table public.workshops to authenticated;

-- Refunds and payment email/webhook ledgers are server-side only.
revoke all on table public.program_order_emails from anon, authenticated;
revoke all on table public.razorpay_webhook_events from anon, authenticated;
revoke all on table public.program_refunds from anon, authenticated;

-- Preserve the existing profile column restriction: client users can only edit profile details, never role.
revoke update on table public.profiles from authenticated;
grant update (full_name, avatar_url, bio) on table public.profiles to authenticated;

-- After a refund is initiated, student content/announcement access must remain limited to active/completed enrollment.
drop policy if exists announcements_student_read on public.announcements;
create policy announcements_student_read on public.announcements
  for select to authenticated
  using (
    published_at <= now()
    and (
      audience_type = 'all'
      or exists (
        select 1
        from public.program_enrollments pe
        where pe.user_id = auth.uid()
          and pe.program_id = announcements.program_id
          and pe.status in ('active', 'completed')
      )
    )
  );

-- Students need their own profile plus Admin identities and identities visible in active community rooms/conversations;
-- do not expose every student's profile row to every other student.
drop policy if exists profiles_select_authenticated_messaging on public.profiles;
create policy profiles_select_messaging on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or role = 'admin'
    or exists (
      select 1
      from public.chatroom_messages cm
      join public.chatrooms cr on cr.id = cm.chatroom_id
      where cm.sender_id = profiles.id
        and cr.is_active = true
    )
    or exists (
      select 1
      from public.conversation_members mine
      join public.conversation_members other on other.conversation_id = mine.conversation_id
      where mine.user_id = auth.uid()
        and other.user_id = profiles.id
    )
  );

-- An authenticated caller must be signed in to create a conversation.
drop policy if exists conversations_authenticated_insert on public.conversations;
create policy conversations_authenticated_insert on public.conversations
  for insert to authenticated
  with check (auth.uid() is not null);

-- Security-definer functions are callable only by the roles that actually need them.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_program_enrolled(uuid) to authenticated;
grant execute on function public.admin_enroll_student(uuid, uuid) to authenticated;
grant execute on function public.admin_get_course_roster(uuid) to authenticated;
grant execute on function public.admin_get_program_payment(uuid) to authenticated;
grant execute on function public.admin_get_program_roster(uuid) to authenticated;
grant execute on function public.admin_list_program_payments() to authenticated;
grant execute on function public.admin_list_students() to authenticated;
grant execute on function public.admin_program_students(uuid) to authenticated;
grant execute on function public.admin_set_course_enrollment(uuid, uuid, boolean) to authenticated;
grant execute on function public.admin_set_program_enrollment(uuid, uuid, boolean) to authenticated;
grant execute on function public.admin_unenroll_student(uuid, uuid) to authenticated;
grant execute on function public.get_assessment_analytics(uuid) to authenticated;
grant execute on function public.get_assessment_attempt_results(uuid) to authenticated;
grant execute on function public.get_student_assessment(uuid) to authenticated;
grant execute on function public.issue_course_certificate(uuid) to authenticated;
grant execute on function public.start_course_assessment(uuid) to authenticated;
grant execute on function public.submit_course_assessment(uuid, jsonb) to authenticated;
grant execute on function public.write_admin_audit(text, text, uuid, text, jsonb) to authenticated;

-- Keep the server-side service role able to call existing functions where it previously had explicit EXECUTE.
grant execute on function public.admin_enroll_student(uuid, uuid) to service_role;
grant execute on function public.admin_get_course_roster(uuid) to service_role;
grant execute on function public.admin_get_program_payment(uuid) to service_role;
grant execute on function public.admin_get_program_roster(uuid) to service_role;
grant execute on function public.admin_list_program_payments() to service_role;
grant execute on function public.admin_list_students() to service_role;
grant execute on function public.admin_program_students(uuid) to service_role;
grant execute on function public.admin_set_course_enrollment(uuid, uuid, boolean) to service_role;
grant execute on function public.admin_set_program_enrollment(uuid, uuid, boolean) to service_role;
grant execute on function public.admin_unenroll_student(uuid, uuid) to service_role;
grant execute on function public.get_assessment_analytics(uuid) to service_role;
grant execute on function public.get_assessment_attempt_results(uuid) to service_role;
grant execute on function public.get_student_assessment(uuid) to service_role;
grant execute on function public.get_user_id_by_email(text) to service_role;
grant execute on function public.is_admin() to service_role;
grant execute on function public.is_program_enrolled(uuid) to service_role;
grant execute on function public.issue_course_certificate(uuid) to service_role;
grant execute on function public.start_course_assessment(uuid) to service_role;
grant execute on function public.submit_course_assessment(uuid, jsonb) to service_role;
grant execute on function public.write_admin_audit(text, text, uuid, text, jsonb) to service_role;

-- New public-schema objects should not automatically become Data API-callable.
alter default privileges for role postgres in schema public revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
