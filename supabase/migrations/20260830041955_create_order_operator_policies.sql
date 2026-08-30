grant select, insert on table public.orders to authenticated;
grant update (
  status,
  estimated_ready_at,
  estimate_updated_at,
  cancellation_reason_code,
  cancellation_reason_text,
  preparing_at,
  ready_at,
  delivered_at,
  cancelled_at,
  updated_by,
  version,
  updated_at
) on table public.orders to authenticated;
grant usage, select on sequence public.orders_id_seq to authenticated;

grant select, insert on table public.order_status_history to authenticated;
grant usage, select on sequence public.order_status_history_id_seq to authenticated;

create policy orders_operator_select
on public.orders
for select
to authenticated
using (public.has_active_restaurant_membership(restaurant_id));

create policy orders_operator_insert
on public.orders
for insert
to authenticated
with check (
  public.has_active_restaurant_membership(restaurant_id)
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy orders_operator_update
on public.orders
for update
to authenticated
using (public.has_active_restaurant_membership(restaurant_id))
with check (
  public.has_active_restaurant_membership(restaurant_id)
  and updated_by = (select auth.uid())
);

create policy order_status_history_operator_select
on public.order_status_history
for select
to authenticated
using (public.has_active_restaurant_membership(restaurant_id));

create policy order_status_history_operator_insert
on public.order_status_history
for insert
to authenticated
with check (
  public.has_active_restaurant_membership(restaurant_id)
  and changed_by = (select auth.uid())
);
