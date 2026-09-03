-- Program/LMS schema foundation.
-- These objects already exist in the deployed database, but this migration
-- keeps a clean repository reset self-contained instead of depending on
-- dashboard-only schema changes.

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(), slug text unique not null, title text not null,
  description text, status text not null default 'draft' check (status in ('draft','published','archived')),
  sort_order integer not null default 0, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), price_inr integer not null default 0, payment_enabled boolean not null default false
);
create table if not exists public.program_enrollments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed','cancelled','refund_pending','refunded')),
  enrolled_at timestamptz not null default now(), completed_at timestamptz, unique (user_id, program_id)
);
create table if not exists public.program_orders (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
  program_id uuid not null references public.programs(id) on delete restrict, amount_inr integer not null check (amount_inr >= 0),
  currency text not null default 'INR', status text not null default 'created' check (status in ('created','paid','failed','cancelled','refund_pending','refunded')),
  provider text not null default 'razorpay', provider_order_id text unique, provider_payment_id text unique,
  created_at timestamptz not null default now(), paid_at timestamptz, metadata jsonb not null default '{}'::jsonb
);

alter table public.courses add column if not exists access_type text not null default 'free';
alter table public.courses add column if not exists duration_minutes integer;
alter table public.courses add column if not exists program_id uuid references public.programs(id) on delete set null;
alter table public.courses add column if not exists assessment_enabled boolean not null default false;
alter table public.courses add column if not exists assessment_required boolean not null default false;
alter table public.courses drop constraint if exists courses_access_type_check;
alter table public.courses add constraint courses_access_type_check check (access_type = any (array['free'::text,'paid'::text,'service'::text]));

create table if not exists public.course_assessments (
  id uuid primary key default gen_random_uuid(), course_id uuid not null unique references public.courses(id) on delete cascade,
  title text not null default 'Course Assessment', instructions text, passing_percentage numeric(5,2) not null default 80 check (passing_percentage between 1 and 100),
  max_attempts integer check (max_attempts is null or max_attempts > 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  question_count integer, time_limit_minutes integer, randomize_questions boolean not null default true, randomize_options boolean not null default true,
  feedback_mode text not null default 'score_only', require_completion boolean not null default true, integrity_ack_required boolean not null default true
);
create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(), assessment_id uuid not null references public.course_assessments(id) on delete cascade,
  prompt text not null, options jsonb not null, correct_option text not null, points integer not null default 1, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), explanation text, unique (assessment_id, sort_order)
);
create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(), assessment_id uuid not null references public.course_assessments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, attempt_number integer not null, score numeric not null default 0,
  passed boolean not null default false, answers jsonb not null default '{}'::jsonb, submitted_at timestamptz not null default now(), unique (assessment_id, user_id, attempt_number)
);
create table if not exists public.course_certificates (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade, certificate_number text not null unique,
  issued_at timestamptz not null default now(), created_at timestamptz not null default now(), unique (user_id, course_id)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(), title text not null, body text not null, audience_type text not null default 'all',
  program_id uuid references public.programs(id) on delete set null, published_at timestamptz not null default now(), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), created_by uuid not null references auth.users(id) on delete restrict
);
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(), admin_user_id uuid not null references auth.users(id) on delete restrict, action text not null,
  target_type text not null, target_id uuid, target_label text, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), created_by uuid not null default auth.uid() references auth.users(id) on delete restrict
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  primary key (conversation_id, user_id)
);
create table if not exists public.chatrooms (
  id uuid primary key default gen_random_uuid(), name text not null, description text, created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), is_active boolean not null default true
);
create table if not exists public.chatroom_messages (
  id uuid primary key default gen_random_uuid(), chatroom_id uuid not null references public.chatrooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade, body text not null, created_at timestamptz not null default now(), read_at timestamptz
);
create table if not exists public.chatroom_message_reads (
  message_id uuid not null references public.chatroom_messages(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(), primary key (message_id, user_id)
);

-- Discussion tables are part of the deployed community surface. Keep their
-- schema in the migration chain so a clean local reset matches production.
create table if not exists public.discussion_threads (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade, title text not null, body text not null,
  pinned boolean not null default false, locked boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.discussion_replies (
  id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.discussion_threads(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade, body text not null, created_at timestamptz not null default now()
);

alter table public.programs enable row level security;
alter table public.program_enrollments enable row level security;
alter table public.program_orders enable row level security;
alter table public.course_assessments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.course_certificates enable row level security;
alter table public.announcements enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.chatrooms enable row level security;
alter table public.chatroom_messages enable row level security;
alter table public.chatroom_message_reads enable row level security;
alter table public.discussion_threads enable row level security;
alter table public.discussion_replies enable row level security;

revoke all on public.program_orders from anon, authenticated;
revoke all on public.program_enrollments from anon, authenticated;
revoke all on public.admin_audit_log from anon, authenticated;

create index if not exists courses_program_id_idx on public.courses(program_id);
create index if not exists program_enrollments_user_idx on public.program_enrollments(user_id);
create index if not exists program_enrollments_program_idx on public.program_enrollments(program_id);
create index if not exists program_orders_program_idx on public.program_orders(program_id);
create index if not exists program_orders_user_idx on public.program_orders(user_id);
create index if not exists assessment_questions_assessment_idx on public.assessment_questions(assessment_id);
create index if not exists assessment_attempts_assessment_user_idx on public.assessment_attempts(assessment_id,user_id);
create index if not exists discussion_threads_course_idx on public.discussion_threads(course_id, updated_at desc);
create index if not exists discussion_replies_thread_idx on public.discussion_replies(thread_id, created_at);
