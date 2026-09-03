create table if not exists public.program_refunds (
  id uuid primary key default gen_random_uuid(),
  program_order_id uuid not null references public.program_orders(id) on delete restrict,
  enrollment_id uuid references public.program_enrollments(id) on delete set null,
  razorpay_payment_id text not null,
  razorpay_refund_id text not null unique,
  amount_inr integer not null check (amount_inr > 0),
  currency text not null default 'INR',
  status text not null default 'pending' check (status in ('pending','processed','failed')),
  speed_requested text,
  speed_processed text,
  reason text,
  initiated_by uuid references auth.users(id) on delete set null,
  failure_reason text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists program_refunds_order_idx on public.program_refunds(program_order_id);
create index if not exists program_refunds_payment_idx on public.program_refunds(razorpay_payment_id);
create index if not exists program_refunds_status_idx on public.program_refunds(status);

alter table public.program_refunds enable row level security;
revoke all on public.program_refunds from anon, authenticated;
grant all on public.program_refunds to service_role;

drop trigger if exists program_refunds_updated_at on public.program_refunds;
create trigger program_refunds_updated_at before update on public.program_refunds for each row execute function public.set_updated_at();

alter table public.program_orders drop constraint if exists program_orders_status_check;
alter table public.program_orders add constraint program_orders_status_check check (status = any (array['created'::text,'paid'::text,'failed'::text,'cancelled'::text,'refund_pending'::text,'refunded'::text]));

alter table public.program_enrollments drop constraint if exists program_enrollments_status_check;
alter table public.program_enrollments add constraint program_enrollments_status_check check (status = any (array['active'::text,'completed'::text,'cancelled'::text,'refund_pending'::text,'refunded'::text]));

create or replace function public.admin_list_program_payments()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc), '[]'::jsonb)
    into v_result
  from (
    select
      po.id,
      po.program_id,
      p.title as program_title,
      po.user_id,
      coalesce(nullif(trim(coalesce(pr.full_name,'')),''), po.metadata->>'guest_name', po.metadata->>'guest_email') as student_name,
      coalesce(po.metadata->>'guest_email', u.email) as student_email,
      po.amount_inr,
      po.currency,
      po.status,
      po.provider_order_id,
      po.provider_payment_id,
      po.created_at,
      po.paid_at,
      pe.status as enrollment_status,
      coalesce((select sum(r.amount_inr) from public.program_refunds r where r.program_order_id=po.id and r.status='processed'),0) as refunded_amount_inr,
      coalesce((select sum(r.amount_inr) from public.program_refunds r where r.program_order_id=po.id and r.status in ('pending','processed')),0) as refund_committed_amount_inr
    from public.program_orders po
    join public.programs p on p.id=po.program_id
    left join auth.users u on u.id=po.user_id
    left join public.profiles pr on pr.id=po.user_id
    left join public.program_enrollments pe on pe.user_id=po.user_id and pe.program_id=po.program_id
  ) x;
  return v_result;
end;
$$;
revoke all on function public.admin_list_program_payments() from public, anon, authenticated;
grant execute on function public.admin_list_program_payments() to authenticated;

create or replace function public.admin_get_program_payment(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  select jsonb_build_object(
    'order', to_jsonb(po),
    'program_title', p.title,
    'student_name', coalesce(nullif(trim(coalesce(pr.full_name,'')),''), po.metadata->>'guest_name', u.email),
    'student_email', coalesce(po.metadata->>'guest_email', u.email),
    'enrollment_status', pe.status,
    'refunds', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.program_refunds r where r.program_order_id=po.id),'[]'::jsonb)
  ) into v_result
  from public.program_orders po
  join public.programs p on p.id=po.program_id
  left join auth.users u on u.id=po.user_id
  left join public.profiles pr on pr.id=po.user_id
  left join public.program_enrollments pe on pe.user_id=po.user_id and pe.program_id=po.program_id
  where po.id=p_order_id;
  if v_result is null then raise exception 'Payment order not found'; end if;
  return v_result;
end;
$$;
revoke all on function public.admin_get_program_payment(uuid) from public, anon, authenticated;
grant execute on function public.admin_get_program_payment(uuid) to authenticated;
