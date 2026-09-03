alter table public.program_refunds add column if not exists idempotency_key text;
create unique index if not exists program_refunds_idempotency_key_idx on public.program_refunds(idempotency_key) where idempotency_key is not null;
