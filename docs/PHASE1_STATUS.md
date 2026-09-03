# Phase 1 Status

## Phase 1 — Foundation

Completed:
- Public Coach Amit Soni site transformation.
- Student Learning Hub UI foundation.
- Supabase LMS foundation and live production project connection.
- Supabase Auth/profile trigger and Student/Admin role model.
- Program-based course access and enrollment controls.
- Course, module, lesson, workshop, messaging, notification, discussion and announcement foundations.
- Course assessments, retakes, completion eligibility and student results.
- Automatic course certificate issuance and certificate eligibility.
- Razorpay program checkout, payment verification, webhook processing and confirmation email flow.
- Admin Payments & Refunds workflow with Razorpay refund lifecycle handling.
- Refund-aware webhook endpoint with idempotent event processing.
- Production Vercel deployment and `learn.coachamitsoni.com` alias.

## Phase 2 — Security Hardening

Completed so far:
- Application role model normalized to **Student + Admin only**. Coach is represented operationally by the Admin role; there is no separate Coach/Instructor/Staff application role.
- Removed the legacy `is_staff()` authorization helper and replaced remaining live staff authorization policies with explicit Admin authorization.
- Tightened Data API grants and RLS for sensitive payment/refund/email/webhook data.
- Payment orders and program enrollments are read-only to client roles; mutations are performed by trusted server-side functions or Admin RPCs.
- Secured Student/Admin conversation ownership and messaging access.
- Secured Admin-only RPC execution and sensitive server-side ledgers.
- Added Student/Admin database security regression tests under `supabase/tests/database/student_admin_security.test.sql`.
- Audited active Edge Functions: user-facing functions require JWT authentication; external Razorpay webhooks use `verify_jwt=false` with mandatory Razorpay signature verification.
- Audited private `course-content` Storage bucket and its Student/Admin policies.
- Completed production configuration review: payment/webhook JWT settings are explicitly represented in `supabase/config.toml`, sensitive provider credentials are read only from Edge Function environment secrets, and no Razorpay secret, Resend API key, or Supabase service-role credential is present in the Git repository.
- Completed production payment/refund/email operational verification, including successful payment confirmation email delivery and a successful full-refund lifecycle test.
- Completed Student/Admin end-to-end regression testing across the launch checklist.

Remaining Phase 2 work:
- Run the full database security test suite in CI/production-equivalent tooling. The pgTAP test file is committed, while equivalent live SQL security assertions have already been executed successfully; the remaining item is execution through the repository's full test runner/tooling.
