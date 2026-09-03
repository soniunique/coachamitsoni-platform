-- Give each conversation an explicit owner so Student -> Admin inbox creation can be authorized safely.
alter table public.conversations add column created_by uuid references auth.users on delete cascade;
update public.conversations set created_by = null where created_by is not null;
alter table public.conversations alter column created_by set default auth.uid();

-- Existing conversations were empty at the time of this migration.
drop policy if exists conversations_authenticated_insert on public.conversations;
create policy conversations_authenticated_insert on public.conversations
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists conversations_member_read on public.conversations;
create policy conversations_member_read on public.conversations
  for select to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversations.id
        and cm.user_id = auth.uid()
    )
  );

-- Tighten Student -> Admin membership to conversations owned by that Student.
drop policy if exists conversation_members_student_add_admin on public.conversation_members;
create policy conversation_members_student_add_admin on public.conversation_members
  for insert to authenticated
  with check (
    user_id <> auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = conversation_members.user_id
        and p.role = 'admin'
    )
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_members.conversation_id
        and c.created_by = auth.uid()
    )
  );
