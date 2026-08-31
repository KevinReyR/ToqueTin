create function public.get_dashboard_summary(
  p_restaurant_id bigint,
  p_started_at timestamptz default null,
  p_ended_at timestamptz default null
)
returns table (
  restaurant_id bigint,
  operational_day_started_at timestamptz,
  operational_day_ended_at timestamptz,
  orders jsonb,
  order_count_by_status jsonb,
  total_created bigint,
  total_active bigint,
  average_preparation_seconds double precision,
  average_pickup_seconds double precision
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_restaurant public.restaurants%rowtype;
  v_day record;
  v_started_at timestamptz;
  v_ended_at timestamptz;
begin
  if p_restaurant_id is null
    or (p_started_at is null) <> (p_ended_at is null)
    or (p_started_at is not null and p_started_at >= p_ended_at) then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  if not public.is_operator_identity()
    or not public.has_active_restaurant_membership(p_restaurant_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  perform public.promote_pending_day_cutoff(p_restaurant_id, v_now);

  select restaurants.*
  into v_restaurant
  from public.restaurants as restaurants
  where restaurants.id = p_restaurant_id;

  if not found then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_started_at is null then
    select day.*
    into v_day
    from public.calculate_operational_day(
      v_restaurant.timezone,
      v_restaurant.day_cutoff_time,
      v_now
    ) as day;
    v_started_at := v_day.operational_day_started_at;
    v_ended_at := v_day.operational_day_ended_at;
  else
    v_started_at := p_started_at;
    v_ended_at := p_ended_at;
  end if;

  return query
  with day_orders as (
    select order_rows.*
    from public.orders as order_rows
    where order_rows.restaurant_id = p_restaurant_id
      and order_rows.operational_day_started_at = v_started_at
      and order_rows.operational_day_ended_at = v_ended_at
  ), counts as (
    select
      count(*) filter (where status = 'RECEIVED') as received,
      count(*) filter (where status = 'PREPARING') as preparing,
      count(*) filter (where status = 'READY') as ready,
      count(*) filter (where status = 'DELIVERED') as delivered,
      count(*) filter (where status = 'CANCELLED') as cancelled,
      count(*) as total,
      count(*) filter (where status in ('RECEIVED', 'PREPARING', 'READY')) as active
    from day_orders
  ), preparation as (
    select extract(epoch from avg(order_rows.ready_at - order_rows.preparing_at))::double precision as seconds
    from public.orders as order_rows
    where order_rows.restaurant_id = p_restaurant_id
      and order_rows.ready_at >= v_started_at
      and order_rows.ready_at < v_ended_at
      and order_rows.preparing_at is not null
      and order_rows.ready_at >= order_rows.preparing_at
      and order_rows.status <> 'CANCELLED'
  ), pickup as (
    select extract(epoch from avg(order_rows.delivered_at - order_rows.ready_at))::double precision as seconds
    from public.orders as order_rows
    where order_rows.restaurant_id = p_restaurant_id
      and order_rows.delivered_at >= v_started_at
      and order_rows.delivered_at < v_ended_at
      and order_rows.ready_at is not null
      and order_rows.delivered_at >= order_rows.ready_at
      and order_rows.status = 'DELIVERED'
  )
  select
    p_restaurant_id,
    v_started_at,
    v_ended_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', order_rows.id::text,
          'restaurantId', order_rows.restaurant_id::text,
          'orderNumber', order_rows.order_number,
          'status', order_rows.status::text,
          'estimatedReadyAt', order_rows.estimated_ready_at,
          'estimateUpdatedAt', order_rows.estimate_updated_at,
          'pickupInstructions', order_rows.pickup_instructions,
          'version', order_rows.version::text,
          'createdAt', order_rows.created_at,
          'updatedAt', order_rows.updated_at
        ) order by order_rows.created_at desc, order_rows.id desc
      )
      from day_orders as order_rows
    ), '[]'::jsonb),
    jsonb_build_object(
      'RECEIVED', counts.received,
      'PREPARING', counts.preparing,
      'READY', counts.ready,
      'DELIVERED', counts.delivered,
      'CANCELLED', counts.cancelled
    ),
    counts.total,
    counts.active,
    preparation.seconds,
    pickup.seconds
  from counts
  cross join preparation
  cross join pickup;
end;
$$;

revoke execute on function public.get_dashboard_summary(
  bigint,
  timestamptz,
  timestamptz
) from public, anon, service_role;
grant execute on function public.get_dashboard_summary(
  bigint,
  timestamptz,
  timestamptz
) to authenticated;
