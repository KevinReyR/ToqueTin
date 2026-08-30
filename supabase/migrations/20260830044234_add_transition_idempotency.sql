create or replace function public.transition_order(
  p_order_id bigint,
  p_expected_status public.order_status,
  p_target_status public.order_status
)
returns table (
  order_id bigint,
  status public.order_status,
  version bigint,
  updated_at timestamptz,
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
  v_tracking_expires_at timestamptz;
  v_is_exact_repeat boolean := false;
begin
  if v_actor_id is null or not public.is_operator_identity() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_expected_status is null
    or p_target_status is null
    or not (
    (p_expected_status = 'RECEIVED' and p_target_status = 'PREPARING')
    or (p_expected_status = 'PREPARING' and p_target_status = 'READY')
    or (p_expected_status = 'READY' and p_target_status = 'DELIVERED')
  ) then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found
    or not public.has_active_restaurant_membership(v_order.restaurant_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_order.status = p_target_status then
    select
      history.from_status = p_expected_status
      and history.to_status = p_target_status
    into v_is_exact_repeat
    from public.order_status_history as history
    where history.order_id = v_order.id
    order by history.occurred_at desc, history.id desc
    limit 1;

    if coalesce(v_is_exact_repeat, false) then
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
        v_order.updated_at,
        v_tracking_expires_at,
        true;
      return;
    end if;
  end if;

  if v_order.status <> p_expected_status then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  update public.orders
  set
    status = p_target_status,
    preparing_at = case
      when p_target_status = 'PREPARING' then v_occurred_at
      else preparing_at
    end,
    ready_at = case
      when p_target_status = 'READY' then v_occurred_at
      else ready_at
    end,
    delivered_at = case
      when p_target_status = 'DELIVERED' then v_occurred_at
      else delivered_at
    end,
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
    changed_by,
    occurred_at
  ) values (
    v_order.id,
    v_order.restaurant_id,
    p_expected_status,
    p_target_status,
    v_actor_id,
    v_occurred_at
  );

  if p_target_status = 'DELIVERED' then
    v_tracking_expires_at := v_occurred_at + interval '24 hours';

    update public.tracking_sessions
    set expires_at = v_tracking_expires_at
    where public.tracking_sessions.order_id = v_order.id
      and public.tracking_sessions.revoked_at is null;

  end if;

  return query
  select
    v_order.id,
    v_order.status,
    v_order.version,
    v_order.updated_at,
    v_tracking_expires_at,
    false;
end;
$$;
