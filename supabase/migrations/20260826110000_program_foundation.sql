-- Program/LMS schema foundation.
-- These objects already exist in the deployed database, but this migration
-- keeps a clean repository reset self-contained instead of depending on
-- dashboard-only schema changes.

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  price_inr integer not null default 0,
  payment_enabled boolean not null default false
);

create table if not exists public.program_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed','cancelled','refund_pending','refunded')),
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, program_id)
);

create table if not exists public.program_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  program_id uuid not null references public.programs(id) on delete restrict,
  amount_inr integer not null check (amount_inr >= 0),
  currency text not null default 'INR',
  status text not null default 'created' check (status in ('created','paid','failed','cancelled','refund_pending','refunded')),
  provider text not null default 'razorpay',
  provider_order_id text unique,
  provider_payment_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.programs enable row level security;
alter table public.program_enrollments enable row level security;
alter table public.program_orders enable row level security;

revoke all on public.program_orders from anon, authenticated;
revoke all on public.program_enrollments from anon, authenticated;

create index if not exists program_enrollments_user_idx on public.program_enrollments(user_id);
create index if not exists program_enrollments_program_idx on public.program_enrollments(program_id);
create index if not exists program_orders_program_idx on public.program_orders(program_id);
create index if not exists program_orders_user_idx on public.program_orders(user_id);
