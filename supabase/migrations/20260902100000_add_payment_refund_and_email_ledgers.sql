-- Keep the server-side payment/refund/email ledgers in the migration chain.
-- Client access is intentionally denied; Edge Functions use the service role.

create table if not exists public.program_refunds (
  id uuid primary key default gen_random_uuid(),
  program_order_id uuid not null references public.program_orders(id) on delete cascade,
  enrollment_id uuid references public.program_enrollments(id) on delete set null,
  razorpay_payment_id text not null,
  razorpay_refund_id text not null unique,
  amount_inr numeric(12,2) not null check (amount_inr > 0),
  currency text not null default 'INR',
  status text not null default 'pending' check (status in ('pending','processed','failed')),
  speed_requested text,
  speed_processed text,
  reason text,
  initiated_by uuid references auth.users(id) on delete set null,
  processed_at timestamptz,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists program_refunds_order_idx
  on public.program_refunds(program_order_id, created_at desc);
create index if not exists program_refunds_payment_idx
  on public.program_refunds(razorpay_payment_id);

create table if not exists public.program_order_emails (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.program_orders(id) on delete cascade,
  email_type text not null,
  recipient_email text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint program_order_emails_order_type_key unique (order_id, email_type)
);

create index if not exists program_order_emails_status_idx
  on public.program_order_emails(status, updated_at desc);

alter table public.program_refunds enable row level security;
alter table public.program_order_emails enable row level security;

revoke all on table public.program_refunds from anon, authenticated;
revoke all on table public.program_order_emails from anon, authenticated;
