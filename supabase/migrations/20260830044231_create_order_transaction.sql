grant update (
  day_cutoff_time,
  pending_day_cutoff_time,
  pending_cutoff_effective_at,
  updated_at
) on table public.restaurants to authenticated;

create policy restaurants_operator_update_operational_cutoff
on public.restaurants
for update
to authenticated
using (public.has_active_restaurant_membership(id))
with check (public.has_active_restaurant_membership(id));

grant insert on table public.tracking_sessions to authenticated;
grant usage, select on sequence public.tracking_sessions_id_seq to authenticated;

create policy tracking_sessions_operator_insert
on public.tracking_sessions
for insert
to authenticated
with check (
  public.is_operator_identity()
  and exists (
    select 1
    from public.orders
    where orders.id = tracking_sessions.order_id
      and public.has_active_restaurant_membership(orders.restaurant_id)
  )
);

revoke execute on function public.promote_pending_day_cutoff(bigint, timestamptz)
from public, anon, service_role;
grant execute on function public.promote_pending_day_cutoff(bigint, timestamptz)
to authenticated;

create function public.create_order(
  p_restaurant_id bigint,
  p_order_number text,
  p_estimated_ready_at timestamptz,
  p_pickup_instructions text default null
)
returns table (
  order_id bigint,
  restaurant_id bigint,
  operational_day_started_at timestamptz,
  operational_day_ended_at timestamptz,
  order_number text,
  status public.order_status,
  estimated_ready_at timestamptz,
  estimate_updated_at timestamptz,
  pickup_instructions text,
  version bigint,
  created_at timestamptz,
  updated_at timestamptz,
  tracking_public_nonce uuid,
  tracking_token_version smallint
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_occurred_at timestamptz := statement_timestamp();
  v_timezone text;
  v_day_cutoff_time time without time zone;
  v_operational_day record;
  v_order public.orders%rowtype;
  v_tracking_session public.tracking_sessions%rowtype;
  v_order_number text := btrim(p_order_number);
  v_pickup_instructions text := nullif(btrim(p_pickup_instructions), '');
begin
  if v_actor_id is null
    or not public.has_active_restaurant_membership(p_restaurant_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_order_number is null
    or v_order_number = ''
    or p_estimated_ready_at is null
    or p_estimated_ready_at <= v_occurred_at then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  select timezone, day_cutoff_time
  into v_timezone, v_day_cutoff_time
  from public.promote_pending_day_cutoff(p_restaurant_id, v_occurred_at);

  if not found then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select *
  into v_operational_day
  from public.calculate_operational_day(
    v_timezone,
    v_day_cutoff_time,
    v_occurred_at
  );

  insert into public.orders (
    restaurant_id,
    operational_day_started_at,
    operational_day_ended_at,
    order_number,
    order_number_normalized,
    status,
    estimated_ready_at,
    estimate_updated_at,
    pickup_instructions,
    created_by,
    updated_by,
    version,
    created_at,
    updated_at
  ) values (
    p_restaurant_id,
    v_operational_day.operational_day_started_at,
    v_operational_day.operational_day_ended_at,
    v_order_number,
    public.normalize_order_number(v_order_number),
    'RECEIVED',
    p_estimated_ready_at,
    v_occurred_at,
    v_pickup_instructions,
    v_actor_id,
    v_actor_id,
    1,
    v_occurred_at,
    v_occurred_at
  )
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
    null,
    'RECEIVED',
    v_actor_id,
    v_occurred_at
  );

  insert into public.tracking_sessions (order_id, created_at)
  values (v_order.id, v_occurred_at)
  returning * into v_tracking_session;

  return query
  select
    v_order.id,
    v_order.restaurant_id,
    v_order.operational_day_started_at,
    v_order.operational_day_ended_at,
    v_order.order_number,
    v_order.status,
    v_order.estimated_ready_at,
    v_order.estimate_updated_at,
    v_order.pickup_instructions,
    v_order.version,
    v_order.created_at,
    v_order.updated_at,
    v_tracking_session.public_nonce,
    v_tracking_session.token_version;
end;
$$;

revoke execute on function public.create_order(bigint, text, timestamptz, text)
from public, anon, service_role;
grant execute on function public.create_order(bigint, text, timestamptz, text)
to authenticated;
