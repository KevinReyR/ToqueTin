grant select on table public.organizations, public.restaurants, public.restaurant_users
to authenticated;

create policy organizations_operator_select
on public.organizations
for select
to authenticated
using (
  public.is_operator_identity()
  and exists (
    select 1
    from public.restaurants
    where organization_id = organizations.id
      and public.has_active_restaurant_membership(id)
  )
);

create policy restaurants_operator_select
on public.restaurants
for select
to authenticated
using (public.has_active_restaurant_membership(id));

create policy restaurant_users_operator_select_own_active
on public.restaurant_users
for select
to authenticated
using (
  public.is_operator_identity()
  and user_id = (select auth.uid())
  and is_active
  and role = 'OPERATOR'
);
