create table if not exists public.razorpay_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  provider_order_id text,
  status text not null default 'received' check (status in ('received','processed','ignored','failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);

create index if not exists idx_razorpay_webhook_events_order_id
  on public.razorpay_webhook_events(provider_order_id);

create index if not exists idx_razorpay_webhook_events_received_at
  on public.razorpay_webhook_events(received_at desc);

alter table public.razorpay_webhook_events enable row level security;

revoke all on public.razorpay_webhook_events from anon, authenticated;
