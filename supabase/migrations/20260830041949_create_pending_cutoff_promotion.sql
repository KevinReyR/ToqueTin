create function public.promote_pending_day_cutoff(
  p_restaurant_id bigint,
  p_reference_at timestamptz
)
returns table (
  timezone text,
  day_cutoff_time time without time zone,
  promoted boolean
)
language plpgsql
volatile
strict
security invoker
set search_path = ''
as $$
declare
  restaurant_row public.restaurants%rowtype;
begin
  select *
  into restaurant_row
  from public.restaurants
  where id = p_restaurant_id
  for update;

  if not found then
    return;
  end if;

  promoted := restaurant_row.pending_cutoff_effective_at is not null
    and restaurant_row.pending_cutoff_effective_at <= p_reference_at;

  if promoted then
    update public.restaurants
    set
      day_cutoff_time = restaurant_row.pending_day_cutoff_time,
      pending_day_cutoff_time = null,
      pending_cutoff_effective_at = null,
      updated_at = p_reference_at
    where id = restaurant_row.id
    returning * into restaurant_row;
  end if;

  timezone := restaurant_row.timezone;
  day_cutoff_time := restaurant_row.day_cutoff_time;
  return next;
end;
$$;

revoke execute on function public.promote_pending_day_cutoff(bigint, timestamptz)
from public, anon, authenticated, service_role;
