-- Conversations are always owned by the authenticated user that creates them.
alter table public.conversations alter column created_by set not null;
