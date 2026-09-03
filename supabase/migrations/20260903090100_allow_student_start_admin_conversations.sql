-- Allow the Student -> Admin inbox flow without permitting Student-to-Student membership injection.
drop policy if exists conversation_members_student_add_admin on public.conversation_members;
create policy conversation_members_student_add_admin on public.conversation_members
  for insert to authenticated
  with check (
    user_id <> auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = conversation_members.user_id
        and p.role = 'admin'
    )
  );
