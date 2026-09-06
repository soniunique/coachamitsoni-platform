# CoachAmitSoni LMS — Production Recovery Point

Date: 2026-09-06

This file records the verified recovery checkpoint for the live LMS. It is a recovery manifest, not a substitute for an off-site database dump.

## Application source / deployment

- GitHub repository: `soniunique/coachamitsoni-platform`
- Branch: `main`
- Recovery commit: `e6b060ef74fbe9a1b0dc72d193e966cea0c352be`
- Commit: `Reorder LMS navigation into logical learning and admin flows`
- Production deployment: `dpl_EaqHaFA3PtxpvEZ66VmBqs5MphWy`
- Production alias: `https://learn.coachamitsoni.com`
- Deployment state: `READY`
- Vercel project ID: `prj_nxhpeD944EdfGCLoh6xudwudMwgb`
- Vercel team ID: `team_czaYJEMoNcIVmzLTdD39qtfW`

The immutable Vercel production deployment is the deployment-level recovery point for this application state.

## Supabase production

- Project: `coachamitsoni-lms`
- Project ref: `mszzavokfsayxxfreono`
- Region: `ap-south-1`
- Database: PostgreSQL 17.6.1.155
- Project state at checkpoint: `ACTIVE_HEALTHY`
- Organization: `coachamitsoni`
- Plan at checkpoint: `Free`

## Database inventory at checkpoint

All listed public tables have RLS enabled.

| Table | Rows |
|---|---:|
| profiles | 8 |
| courses | 6 |
| course_modules | 14 |
| course_lessons | 38 |
| enrollments | 1 |
| lesson_progress | 79 |
| workshops | 6 |
| workshop_registrations | 8 |
| feed_posts | 0 |
| notifications | 18 |
| conversations | 0 |
| conversation_members | 0 |
| messages | 0 |
| programs | 4 |
| program_enrollments | 14 |
| chatrooms | 3 |
| chatroom_messages | 4 |
| chatroom_message_reads | 10 |
| announcements | 3 |
| course_certificates | 14 |
| admin_audit_log | 71 |
| course_assessments | 3 |
| assessment_questions | 21 |
| assessment_attempts | 9 |
| assessment_sessions | 9 |
| discussion_threads | 1 |
| discussion_replies | 1 |
| program_orders | 16 |
| razorpay_webhook_events | 17 |
| program_order_emails | 3 |
| program_refunds | 1 |

## Supabase migrations

The production database currently contains the complete migration history through:

`20260905090906_add_lesson_learner_notes_and_resource_link`

The migration files are version-controlled in the GitHub repository and therefore form the schema reconstruction source of truth.

## Edge Functions

Active production Edge Functions at checkpoint:

- `send-learning-email` — v6
- `send-workshop-registration-email` — v4
- `get-student-emails` — v3
- `create-program-payment-order` — v7
- `verify-program-payment` — v7
- `razorpay-program-webhook` — v7
- `issue-program-refund` — v1
- `razorpay-program-webhook-v2` — v2

## Current flagship test content

Program:

`AI agents Domination Program`

Course:

`AI Agents Domination — Foundations to Production`

Course state: `published`

Assessment:

`AI Agents Domination — Final Assessment`

Assessment configuration at checkpoint:

- 10 questions
- 70% passing score
- 3 maximum attempts
- 15-minute time limit
- random question order
- random option order
- full review feedback
- course completion required
- integrity acknowledgement required

## Backup limitations / required off-site action

Supabase confirms that the current organization is on the Free Plan. Supabase documentation states that downloadable database backups are not provided for Free Plan projects and recommends regular `supabase db dump` logical backups maintained off-site.

Also note: Supabase database backups do not include Storage object bytes; Storage files require a separate off-site backup.

Therefore this checkpoint provides:

1. Full application source/version history through GitHub.
2. Immutable production deployment recovery point through Vercel.
3. Version-controlled database schema/migration recovery.
4. Current database inventory and recovery metadata.

It does **not** constitute a byte-for-byte database or Storage-object backup. A true data-level backup still requires an off-site logical database dump plus a separate Storage-object copy.

## Recommended restore order

1. Recover/checkout the GitHub recovery commit recorded above.
2. Recreate the Supabase schema by applying the version-controlled migrations in order.
3. Restore the off-site logical database dump into Supabase.
4. Restore Supabase Storage objects separately.
5. Restore required production environment/secrets in Vercel and Supabase Edge Functions.
6. Deploy the recovered application to Vercel.
7. Verify Auth, LMS access, program enrolment, lessons/progress, assessments, certificates, discussions/messages, workshops and payment/refund flows.

## Security note

No secrets, API keys, database passwords, or environment-variable values are stored in this recovery file.