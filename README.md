# CoachAmitSoni.com

Amit Soni — AI Agents Educator | Cloud Architecture.

## Phase 1 architecture
- Public website: `coachamitsoni.com`
- Student platform: `learn.coachamitsoni.com` (separate authenticated application)

## Public site
The public site is adapted from the approved Shweta repository foundation but uses Amit-specific content, branding and visuals. The student LMS is not present in this repository and will be implemented as a separate authenticated application.

## Local development
Use the existing project tooling documented by the repository's package.json/bun configuration. Do not copy source `.env` credentials. Configure a separate Amit Supabase project and environment variables.

## Important
Never commit Supabase secrets, service-role keys or source-project credentials.

## Supabase connection

The repository is prepared for the dedicated Amit Supabase project:

- Project: `coachamitsoni-lms`
- Region: South Asia (Mumbai)
- Project reference: `mszzavokfsayxxfreono`
- URL: `https://mszzavokfsayxxfreono.supabase.co`

Copy `.env.example` to `.env.local` and add the Supabase publishable key. The key is intentionally not stored in this repository.

See `SUPABASE_CONNECTION.md` for the exact setup and security rules.
