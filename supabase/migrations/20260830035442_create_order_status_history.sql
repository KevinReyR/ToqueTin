create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id bigint not null,
  restaurant_id bigint not null,
  from_status public.order_status,
  to_status public.order_status not null,
  reason_code public.cancellation_reason_code,
  reason_text text,
  changed_by uuid not null,
  occurred_at timestamptz not null default now(),
  constraint order_status_history_order_restaurant_fkey
    foreign key (order_id, restaurant_id)
    references public.orders (id, restaurant_id)
    on delete restrict,
  constraint order_status_history_changed_by_fkey
    foreign key (changed_by)
    references auth.users (id)
    on delete restrict,
  constraint order_status_history_initial_event_valid check (
    from_status is not null or to_status = 'RECEIVED'
  ),
  constraint order_status_history_reason_consistent check (
    (
      to_status = 'CANCELLED'
      and reason_code is not null
      and (
        (
          reason_code = 'OTHER'
          and nullif(btrim(reason_text), '') is not null
        )
        or (reason_code <> 'OTHER' and reason_text is null)
      )
    )
    or (
      to_status <> 'CANCELLED'
      and reason_code is null
      and reason_text is null
    )
  )
);

create index order_status_history_order_occurred_idx
on public.order_status_history (order_id, occurred_at);

create index order_status_history_restaurant_status_occurred_idx
on public.order_status_history (restaurant_id, to_status, occurred_at);

create index order_status_history_changed_by_idx
on public.order_status_history (changed_by);

alter table public.order_status_history enable row level security;

revoke all on table public.order_status_history from anon, authenticated;
revoke all on sequence public.order_status_history_id_seq from anon, authenticated;
