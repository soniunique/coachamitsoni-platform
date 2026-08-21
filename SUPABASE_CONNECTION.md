# CoachAmitSoni — Supabase Connection

## Target project

- Supabase project: `coachamitsoni-lms`
- Project reference: `mszzavokfsayxxfreono`
- Region: South Asia (Mumbai)
- Project URL: `https://mszzavokfsayxxfreono.supabase.co`

## Local setup

1. Copy `.env.example` to `.env.local`.
2. In `.env.local`, replace `PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE` with the project's **publishable key**.
3. Do not paste a `sb_secret_*` key or service-role key into any `VITE_*` variable.
4. Do not commit `.env.local`.
5. Start the app with the repository's normal dev command (`npm run dev` or the package-manager equivalent).

## Current backend status

The Supabase database migration has already been run in the target project. It created the LMS tables with explicit RLS and API grants. Email authentication is enabled, email confirmation is enabled, and the automatic `auth.users -> public.profiles` trigger has been verified with a test user.

## Important

The repository does **not** contain a real publishable key. This is intentional. Add the key locally in `.env.local` or in the deployment platform's environment settings.

The repository also contains a server-side Supabase admin client for future trusted operations. Do not configure `SUPABASE_SERVICE_ROLE_KEY` until a server-side admin feature actually requires it.
