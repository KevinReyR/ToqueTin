create table public.orders (
  id bigint generated always as identity primary key,
  restaurant_id bigint not null,
  operational_day_started_at timestamptz not null,
  operational_day_ended_at timestamptz not null,
  order_number text not null,
  order_number_normalized text not null,
  status public.order_status not null default 'RECEIVED',
  estimated_ready_at timestamptz not null,
  estimate_updated_at timestamptz not null default now(),
  pickup_instructions text,
  cancellation_reason_code public.cancellation_reason_code,
  cancellation_reason_text text,
  preparing_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid not null,
  updated_by uuid not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_restaurant_id_fkey
    foreign key (restaurant_id)
    references public.restaurants (id)
    on delete restrict,
  constraint orders_created_by_fkey
    foreign key (created_by)
    references auth.users (id)
    on delete restrict,
  constraint orders_updated_by_fkey
    foreign key (updated_by)
    references auth.users (id)
    on delete restrict
);

alter table public.orders enable row level security;

revoke all on table public.orders from anon, authenticated;
revoke all on sequence public.orders_id_seq from anon, authenticated;
