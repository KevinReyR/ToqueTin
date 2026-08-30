create function public.update_order_estimate(
  p_order_id bigint,
  p_estimated_ready_at timestamptz
)
returns table (
  order_id bigint,
  estimated_ready_at timestamptz,
  estimate_updated_at timestamptz,
  version bigint,
  updated_at timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_occurred_at timestamptz := statement_timestamp();
  v_order public.orders%rowtype;
begin
  if v_actor_id is null or not public.is_operator_identity() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_estimated_ready_at is null or p_estimated_ready_at <= v_occurred_at then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found
    or not public.has_active_restaurant_membership(v_order.restaurant_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_order.status not in ('RECEIVED', 'PREPARING') then
    raise exception 'ESTIMATE_LOCKED' using errcode = 'P0001';
  end if;

  update public.orders
  set
    estimated_ready_at = p_estimated_ready_at,
    estimate_updated_at = v_occurred_at,
    updated_by = v_actor_id,
    version = public.orders.version + 1,
    updated_at = v_occurred_at
  where id = v_order.id
  returning * into v_order;

  return query
  select
    v_order.id,
    v_order.estimated_ready_at,
    v_order.estimate_updated_at,
    v_order.version,
    v_order.updated_at;
end;
$$;

revoke execute on function public.update_order_estimate(bigint, timestamptz)
from public, anon, service_role;
grant execute on function public.update_order_estimate(bigint, timestamptz)
to authenticated;
