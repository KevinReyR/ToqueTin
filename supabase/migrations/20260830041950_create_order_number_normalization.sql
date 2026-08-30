create function public.normalize_order_number(p_order_number text)
returns text
language sql
immutable
strict
parallel safe
security invoker
set search_path = ''
as $$
  select pg_catalog.upper(pg_catalog.btrim(p_order_number));
$$;

revoke execute on function public.normalize_order_number(text) from public, anon;
grant execute on function public.normalize_order_number(text)
to authenticated, service_role;
