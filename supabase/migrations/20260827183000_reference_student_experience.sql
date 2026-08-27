-- Reference learner experience support: workshops, Zoom links and student support conversations.
-- Student/Admin only; no coach role and no payment gateway changes.

alter table public.workshops
  add column if not exists meeting_url text;

create index if not exists workshops_starts_at_idx on public.workshops(starts_at);

drop policy if exists workshops_admin_insert on public.workshops;
create policy workshops_admin_insert on public.workshops
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists workshops_admin_update on public.workshops;
create policy workshops_admin_update on public.workshops
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists workshops_admin_delete on public.workshops;
create policy workshops_admin_delete on public.workshops
  for delete to authenticated
  using (public.is_admin());

create or replace function public.get_or_create_support_conversation()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  conversation_id uuid;
  admin_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select cm.conversation_id into conversation_id
  from public.conversation_members cm
  where cm.user_id = current_user_id
    and exists (
      select 1
      from public.conversation_members cm2
      join public.profiles p on p.id = cm2.user_id
      where cm2.conversation_id = cm.conversation_id
        and p.role = 'admin'
    )
  limit 1;

  if conversation_id is not null then return conversation_id; end if;

  select p.id into admin_id
  from public.profiles p
  where p.role = 'admin'
  order by p.created_at
  limit 1;

  if admin_id is null then raise exception 'No learning administrator is configured'; end if;

  insert into public.conversations default values returning id into conversation_id;
  insert into public.conversation_members(conversation_id, user_id)
  values (conversation_id, current_user_id), (conversation_id, admin_id)
  on conflict do nothing;

  return conversation_id;
end;
$$;

grant execute on function public.get_or_create_support_conversation() to authenticated;

drop policy if exists conversation_members_admin_read on public.conversation_members;
create policy conversation_members_admin_read on public.conversation_members
  for select to authenticated
  using (public.is_admin());

drop policy if exists messages_admin_read on public.messages;
create policy messages_admin_read on public.messages
  for select to authenticated
  using (public.is_admin());

drop policy if exists messages_admin_insert on public.messages;
create policy messages_admin_insert on public.messages
  for insert to authenticated
  with check (public.is_admin() and sender_id = auth.uid());
