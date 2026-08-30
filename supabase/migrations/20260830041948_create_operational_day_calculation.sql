create function public.calculate_operational_day(
  p_timezone text,
  p_day_cutoff_time time without time zone,
  p_reference_at timestamptz
)
returns table (
  operational_day_started_at timestamptz,
  operational_day_ended_at timestamptz
)
language plpgsql
stable
strict
security invoker
set search_path = ''
as $$
declare
  local_reference timestamp without time zone;
  local_start_date date;
begin
  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = p_timezone
  ) then
    raise exception using
      errcode = '22023',
      message = 'Timezone must be a valid IANA timezone name';
  end if;

  local_reference := p_reference_at at time zone p_timezone;
  local_start_date := case
    when local_reference::time >= p_day_cutoff_time then local_reference::date
    else (local_reference::date - 1)
  end;

  operational_day_started_at :=
    (local_start_date + p_day_cutoff_time) at time zone p_timezone;
  operational_day_ended_at :=
    ((local_start_date + 1) + p_day_cutoff_time) at time zone p_timezone;

  return next;
end;
$$;

revoke execute on function public.calculate_operational_day(
  text,
  time without time zone,
  timestamptz
) from public, anon;
grant execute on function public.calculate_operational_day(
  text,
  time without time zone,
  timestamptz
) to authenticated, service_role;
