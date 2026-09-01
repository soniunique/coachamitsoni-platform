# BACKUP CHECKPOINT — 2026-09-01 22:57 IST

> **IMPORTANT:** This file is a restore checkpoint/manifest. It intentionally contains NO application secrets, API keys, passwords, or user-record payloads.

## GitHub application source

- Repository: `soniunique/coachamitsoni-platform`
- Protected backup branch: `BACKUP_2026-09-01_2257_IST`
- Backup branch was created directly from the production `main` commit:
  - `39f86015431cd1dcf33c10b459682037b7ecc764`
- Default branch at checkpoint: `main`
- Purpose: preserve the exact working code state before further development.

## Supabase production checkpoint

- Project: `coachamitsoni-lms`
- Project ref: `mszzavokfsayxxfreono`
- Region: `ap-south-1`
- PostgreSQL: 17.6.1.155 / engine 17
- Status at checkpoint: ACTIVE_HEALTHY
- Applied migrations at checkpoint: 46

## Supabase Edge Functions

Active functions observed at checkpoint:

- `send-learning-email` — version 4 — JWT verification enabled — SHA-256 `a76e7a40f9a903be7bbe4394d81d81e8c845603d7b48d1bd0101574d06fe3224`
- `send-workshop-registration-email` — version 2 — JWT verification enabled — SHA-256 `f469c840d094fde506f05f78f820d675fca8c73bab9da83d9f1a977019af3ffa`
- `get-student-emails` — version 1 — JWT verification enabled — SHA-256 `53ea06faa421f4a7b24a426b8563d891e24d28f1ad395904b5ab87b3b780673c`

## Database content checkpoint (counts only; no row data copied into this public repository)

- profiles: 3
- programs: 3
- courses: 5
- course_modules: 9
- course_lessons: 18
- program_enrollments: 5
- enrollments: 1
- lesson_progress: 34
- course_assessments: 2
- assessment_questions: 11
- assessment_sessions: 5
- assessment_attempts: 5
- course_certificates: 8
- workshops: 6
- workshop_registrations: 7
- chatrooms: 3
- chatroom_messages: 4
- chatroom_message_reads: 6
- announcements: 3
- notifications: 17
- admin_audit_log: 59
- conversations: 0
- conversation_members: 0
- messages: 0
- feed_posts: 0

Auth user count observed: 3.

## Restore interpretation

The GitHub backup branch preserves the source-code state exactly as it existed at the checkpoint commit. The Supabase project remains the live production database; this manifest records its schema/migration/function/data-count state without exposing production data in the public GitHub repository.

For a full database-data disaster-recovery copy, use Supabase's managed database backup/PITR facilities or a private `pg_dump`/restore process with database credentials. The connected Supabase tool available to this workflow does not expose a raw production database dump/export operation, so no claim is made here that a separate physical database dump was created.

**BACKUP MARKER:** 2026-09-01 22:57 IST
