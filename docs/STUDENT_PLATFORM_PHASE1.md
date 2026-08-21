# Coach Amit Soni Learning Hub — Phase 1

Target host: `learn.coachamitsoni.com`

## Primary navigation
- Feed
- Workshops
- Courses
- Messages

## Secondary controls
- Notifications
- Profile
- Help
- Exit/Logout

## Authentication
Hybrid model: open account registration, enrollment-gated course/workshop content. Supabase Auth integration is wired into the login/register UI but requires Amit's own Supabase project configuration before production use.

## Current implementation
This repository contains the Phase 1 student-platform shell and routes:
- `/learn`
- `/learn/login`
- `/learn/register`
- `/learn/courses`
- `/learn/workshops`
- `/learn/messages`
- `/learn/profile`
- `/learn/help`
- `/learn/notifications`

The content is currently representative UI data. The production data layer for courses, workshops, messages, notifications and enrollment is intentionally the next step.

## Reference screenshots
See `docs/reference/student-platform/`.
