-- Refund ledger is server-side only; admins read refund details through admin RPCs.
revoke all on table public.program_refunds from anon, authenticated;
