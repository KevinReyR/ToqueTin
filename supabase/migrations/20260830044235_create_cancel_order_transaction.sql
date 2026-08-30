create function public.cancel_order(
  p_order_id bigint,
  p_reason_code public.cancellation_reason_code,
  p_reason_text text default null
)
returns table (
  order_id bigint,
  status public.order_status,
  version bigint,
  cancelled_at timestamptz,
  tracking_expires_at timestamptz,
  idempotent boolean
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
  v_previous_status public.order_status;
  v_reason_text text := nullif(btrim(p_reason_text), '');
  v_tracking_expires_at timestamptz;
begin
  if v_actor_id is null or not public.is_operator_identity() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_reason_code is null
    or (p_reason_code = 'OTHER' and v_reason_text is null)
    or (p_reason_code <> 'OTHER' and v_reason_text is not null) then
    raise exception 'CANCELLATION_REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found
    or not public.has_active_restaurant_membership(v_order.restaurant_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_order.status = 'CANCELLED'
    and v_order.cancellation_reason_code = p_reason_code
    and v_order.cancellation_reason_text is not distinct from v_reason_text then
    select sessions.expires_at
    into v_tracking_expires_at
    from public.tracking_sessions as sessions
    where sessions.order_id = v_order.id
      and sessions.revoked_at is null;

    return query
    select
      v_order.id,
      v_order.status,
      v_order.version,
      v_order.cancelled_at,
      v_tracking_expires_at,
      true;
    return;
  end if;

  if v_order.status not in ('RECEIVED', 'PREPARING') then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  v_previous_status := v_order.status;

  update public.orders
  set
    status = 'CANCELLED',
    cancellation_reason_code = p_reason_code,
    cancellation_reason_text = v_reason_text,
    cancelled_at = v_occurred_at,
    updated_by = v_actor_id,
    version = public.orders.version + 1,
    updated_at = v_occurred_at
  where id = v_order.id
  returning * into v_order;

  insert into public.order_status_history (
    order_id,
    restaurant_id,
    from_status,
    to_status,
    reason_code,
    reason_text,
    changed_by,
    occurred_at
  ) values (
    v_order.id,
    v_order.restaurant_id,
    v_previous_status,
    'CANCELLED',
    p_reason_code,
    v_reason_text,
    v_actor_id,
    v_occurred_at
  );

  v_tracking_expires_at := v_occurred_at + interval '24 hours';

  update public.tracking_sessions
  set expires_at = v_tracking_expires_at
  where public.tracking_sessions.order_id = v_order.id
    and public.tracking_sessions.revoked_at is null;

  return query
  select
    v_order.id,
    v_order.status,
    v_order.version,
    v_order.cancelled_at,
    v_tracking_expires_at,
    false;
end;
$$;

revoke execute on function public.cancel_order(
  bigint,
  public.cancellation_reason_code,
  text
) from public, anon, service_role;
grant execute on function public.cancel_order(
  bigint,
  public.cancellation_reason_code,
  text
) to authenticated;
