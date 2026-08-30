create table private.push_subscriptions (
  id bigint generated always as identity primary key,
  auth_user_id uuid not null,
  endpoint text not null,
  p256dh_key text not null,
  auth_key text not null,
  endpoint_digest text not null,
  revoked_at timestamptz,
  expires_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_auth_user_id_fkey
    foreign key (auth_user_id)
    references auth.users (id)
    on delete cascade,
  constraint push_subscriptions_endpoint_not_blank check (btrim(endpoint) <> ''),
  constraint push_subscriptions_p256dh_key_not_blank check (btrim(p256dh_key) <> ''),
  constraint push_subscriptions_auth_key_not_blank check (btrim(auth_key) <> ''),
  constraint push_subscriptions_endpoint_digest_not_blank check (
    btrim(endpoint_digest) <> ''
  ),
  constraint push_subscriptions_endpoint_digest_key unique (endpoint_digest),
  constraint push_subscriptions_revocation_valid check (
    revoked_at is null or revoked_at >= created_at
  ),
  constraint push_subscriptions_expiration_valid check (
    expires_at is null or expires_at >= created_at
  ),
  constraint push_subscriptions_updated_after_creation check (
    updated_at >= created_at
  )
);

create index push_subscriptions_auth_user_id_idx
on private.push_subscriptions (auth_user_id);

create table private.tracking_push_subscriptions (
  tracking_session_id bigint not null,
  push_subscription_id bigint not null,
  enabled_at timestamptz not null default now(),
  disabled_at timestamptz,
  primary key (tracking_session_id, push_subscription_id),
  constraint tracking_push_subscriptions_tracking_session_id_fkey
    foreign key (tracking_session_id)
    references public.tracking_sessions (id)
    on delete restrict,
  constraint tracking_push_subscriptions_push_subscription_id_fkey
    foreign key (push_subscription_id)
    references private.push_subscriptions (id)
    on delete restrict,
  constraint tracking_push_subscriptions_disabled_at_valid check (
    disabled_at is null or disabled_at >= enabled_at
  )
);

create index tracking_push_subscriptions_push_subscription_id_idx
on private.tracking_push_subscriptions (push_subscription_id);

alter table private.push_subscriptions enable row level security;
alter table private.tracking_push_subscriptions enable row level security;

revoke all on table private.push_subscriptions from public, anon, authenticated;
revoke all on table private.tracking_push_subscriptions from public, anon, authenticated;
revoke all on sequence private.push_subscriptions_id_seq from public, anon, authenticated;
