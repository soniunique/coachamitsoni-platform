begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

-- Every exposed application table must keep RLS enabled.
select ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity
  ),
  'All public application tables have RLS enabled'
);

-- Client roles must not receive implicit write access to sensitive server-side ledgers.
select ok(not has_table_privilege('anon', 'public.program_orders', 'INSERT,UPDATE,DELETE'), 'Anon cannot mutate program orders');
select ok(not has_table_privilege('authenticated', 'public.program_orders', 'INSERT,UPDATE,DELETE'), 'Authenticated clients cannot mutate program orders directly');
select ok(not has_table_privilege('anon', 'public.program_refunds', 'SELECT,INSERT,UPDATE,DELETE'), 'Anon cannot access refund ledger');
select ok(not has_table_privilege('authenticated', 'public.program_refunds', 'SELECT,INSERT,UPDATE,DELETE'), 'Authenticated clients cannot access refund ledger directly');
select ok(not has_table_privilege('anon', 'public.program_order_emails', 'SELECT,INSERT,UPDATE,DELETE'), 'Anon cannot access payment email log');
select ok(not has_table_privilege('authenticated', 'public.program_order_emails', 'SELECT,INSERT,UPDATE,DELETE'), 'Authenticated clients cannot access payment email log');
select ok(not has_table_privilege('anon', 'public.razorpay_webhook_events', 'SELECT,INSERT,UPDATE,DELETE'), 'Anon cannot access webhook event log');
select ok(not has_table_privilege('authenticated', 'public.razorpay_webhook_events', 'SELECT,INSERT,UPDATE,DELETE'), 'Authenticated clients cannot access webhook event log');
select ok(not has_table_privilege('anon', 'public.program_enrollments', 'INSERT,UPDATE,DELETE'), 'Anon cannot mutate program enrollments');
select ok(not has_table_privilege('authenticated', 'public.program_enrollments', 'INSERT,UPDATE,DELETE'), 'Authenticated clients cannot mutate program enrollments directly');

-- Only explicitly required public read surfaces are reachable anonymously.
select ok(has_table_privilege('anon', 'public.programs', 'SELECT'), 'Anon can read published programs');
select ok(has_table_privilege('anon', 'public.courses', 'SELECT'), 'Anon can read published courses');
select ok(has_table_privilege('anon', 'public.workshops', 'SELECT'), 'Anon can read public workshops');
select ok(not has_table_privilege('anon', 'public.profiles', 'SELECT'), 'Anon cannot read profiles');

-- Sensitive RPCs must not be callable anonymously.
select ok(not has_function_privilege('anon', 'public.admin_list_students()', 'EXECUTE'), 'Anon cannot execute admin student listing RPC');

select * from finish();
rollback;
