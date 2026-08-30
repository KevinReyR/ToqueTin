create index orders_restaurant_day_status_created_idx
on public.orders (
  restaurant_id,
  operational_day_started_at,
  status,
  created_at desc
);

create index orders_restaurant_ready_at_idx
on public.orders (restaurant_id, ready_at);

create index orders_restaurant_delivered_at_idx
on public.orders (restaurant_id, delivered_at);

create index orders_created_by_idx on public.orders (created_by);
create index orders_updated_by_idx on public.orders (updated_by);
