alter table public.tracking_sessions
  add constraint tracking_sessions_id_order_id_key unique (id, order_id);

create table private.notifications (
  id bigint generated always as identity primary key,
  order_id bigint not null,
  tracking_session_id bigint not null,
  push_subscription_id bigint not null,
  kind private.notification_kind not null default 'ORDER_READY',
  status private.notification_status not null default 'PENDING',
  attempt_count smallint not null default 0,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_order_id_fkey
    foreign key (order_id)
    references public.orders (id)
    on delete restrict,
  constraint notifications_tracking_session_order_fkey
    foreign key (tracking_session_id, order_id)
    references public.tracking_sessions (id, order_id)
    on delete restrict,
  constraint notifications_tracking_push_subscription_fkey
    foreign key (tracking_session_id, push_subscription_id)
    references private.tracking_push_subscriptions (
      tracking_session_id,
      push_subscription_id
    )
    on delete restrict,
  constraint notifications_order_push_kind_key
    unique (order_id, push_subscription_id, kind),
  constraint notifications_attempt_count_valid check (
    attempt_count between 0 and 3
  ),
  constraint notifications_sent_at_consistent check (
    (status = 'SENT') = (sent_at is not null)
  ),
  constraint notifications_last_error_code_not_blank check (
    last_error_code is null or btrim(last_error_code) <> ''
  ),
  constraint notifications_updated_after_creation check (
    updated_at >= created_at
  ),
  constraint notifications_sent_after_creation check (
    sent_at is null or sent_at >= created_at
  )
);

create index notifications_dispatchable_status_next_attempt_idx
on private.notifications (status, next_attempt_at)
where status in ('PENDING', 'FAILED') and attempt_count < 3;

create index notifications_tracking_session_id_idx
on private.notifications (tracking_session_id);

create index notifications_push_subscription_id_idx
on private.notifications (push_subscription_id);

alter table private.notifications enable row level security;

revoke all on table private.notifications from public, anon, authenticated;
revoke all on sequence private.notifications_id_seq from public, anon, authenticated;
