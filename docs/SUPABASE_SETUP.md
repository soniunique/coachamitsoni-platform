# CoachAmitSoni Supabase Setup — Phase 1

Create a NEW Supabase project. Do not reuse credentials from the source repository.

1. Create the Amit Supabase project.
2. Open SQL Editor.
3. Run `supabase/migrations/20260821230000_lms_foundation.sql`.
4. Configure Authentication > Providers > Email.
5. Configure production Site URL and redirect URLs for `https://learn.coachamitsoni.com`.
6. Set the frontend `.env.local` with only the project URL and publishable/anon key.
7. Never put a service-role key in browser code.
8. Test RLS as anonymous, student and coach/admin users before production.

Registration is open, but course/workshop protected content is enrollment-gated.
