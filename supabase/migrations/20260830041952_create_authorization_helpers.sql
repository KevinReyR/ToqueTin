create function public.is_anonymous_identity()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case (select auth.jwt() ->> 'is_anonymous')
    when 'true' then true
    else false
  end;
$$;

create function public.is_operator_identity()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and not public.is_anonymous_identity();
$$;

create function public.has_active_restaurant_membership(p_restaurant_id bigint)
returns boolean
language sql
stable
strict
security invoker
set search_path = ''
as $$
  select public.is_operator_identity()
    and exists (
      select 1
      from public.restaurant_users
      where restaurant_id = p_restaurant_id
        and user_id = (select auth.uid())
        and role = 'OPERATOR'
        and is_active
    );
$$;

revoke execute on function public.is_anonymous_identity() from public, anon;
revoke execute on function public.is_operator_identity() from public, anon;
revoke execute on function public.has_active_restaurant_membership(bigint)
from public, anon;

grant execute on function public.is_anonymous_identity() to authenticated;
grant execute on function public.is_operator_identity() to authenticated;
grant execute on function public.has_active_restaurant_membership(bigint)
to authenticated;
