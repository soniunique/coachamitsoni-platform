-- Read-only verification for the Auth -> Profile trigger.
-- Run in Supabase SQL Editor after creating a test user.

select
  u.id as auth_user_id,
  u.email,
  p.id as profile_id,
  p.full_name,
  p.role,
  p.created_at
from auth.users u
left join public.profiles p
  on p.id = u.id
order by u.created_at desc;
