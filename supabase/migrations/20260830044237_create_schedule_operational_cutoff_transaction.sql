create function public.schedule_operational_cutoff(
  p_restaurant_id bigint,
  p_day_cutoff_time time without time zone
)
returns table (
  restaurant_id bigint,
  day_cutoff_time time without time zone,
  pending_day_cutoff_time time without time zone,
  pending_cutoff_effective_at timestamptz,
  updated_at timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_occurred_at timestamptz := statement_timestamp();
  v_restaurant public.restaurants%rowtype;
  v_operational_day record;
  v_effective_at timestamptz;
  v_candidate_local timestamp without time zone;
begin
  if p_day_cutoff_time is null then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  if not public.has_active_restaurant_membership(p_restaurant_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  perform public.promote_pending_day_cutoff(p_restaurant_id, v_occurred_at);

  select * into v_restaurant
  from public.restaurants
  where id = p_restaurant_id
  for update;

  if not found then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_day_cutoff_time = v_restaurant.day_cutoff_time then
    update public.restaurants
    set
      pending_day_cutoff_time = null,
      pending_cutoff_effective_at = null,
      updated_at = v_occurred_at
    where id = v_restaurant.id
    returning * into v_restaurant;

    return query
    select
      v_restaurant.id,
      v_restaurant.day_cutoff_time,
      v_restaurant.pending_day_cutoff_time,
      v_restaurant.pending_cutoff_effective_at,
      v_restaurant.updated_at;
    return;
  end if;

  select * into v_operational_day
  from public.calculate_operational_day(
    v_restaurant.timezone,
    v_restaurant.day_cutoff_time,
    v_occurred_at
  );

  v_candidate_local :=
    (v_operational_day.operational_day_ended_at at time zone v_restaurant.timezone)::date
    + p_day_cutoff_time;
  v_effective_at := v_candidate_local at time zone v_restaurant.timezone;

  if v_effective_at < v_operational_day.operational_day_ended_at then
    v_effective_at := (v_candidate_local + interval '1 day')
      at time zone v_restaurant.timezone;
  end if;

  update public.restaurants
  set
    pending_day_cutoff_time = p_day_cutoff_time,
    pending_cutoff_effective_at = v_effective_at,
    updated_at = v_occurred_at
  where id = v_restaurant.id
  returning * into v_restaurant;

  return query
  select
    v_restaurant.id,
    v_restaurant.day_cutoff_time,
    v_restaurant.pending_day_cutoff_time,
    v_restaurant.pending_cutoff_effective_at,
    v_restaurant.updated_at;
end;
$$;

revoke execute on function public.schedule_operational_cutoff(
  bigint,
  time without time zone
) from public, anon, service_role;
grant execute on function public.schedule_operational_cutoff(
  bigint,
  time without time zone
) to authenticated;
