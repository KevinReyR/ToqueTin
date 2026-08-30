create table public.restaurant_users (
  restaurant_id bigint not null,
  user_id uuid not null,
  role public.restaurant_user_role not null default 'OPERATOR',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (restaurant_id, user_id),
  constraint restaurant_users_restaurant_id_fkey
    foreign key (restaurant_id)
    references public.restaurants (id)
    on delete restrict,
  constraint restaurant_users_user_id_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete restrict
);

create index restaurant_users_user_id_restaurant_id_idx
on public.restaurant_users (user_id, restaurant_id);

alter table public.restaurant_users enable row level security;

revoke all on table public.restaurant_users from anon, authenticated;
