create table public.tracking_sessions (
  id bigint generated always as identity primary key,
  order_id bigint not null,
  public_nonce uuid not null default gen_random_uuid(),
  token_version smallint not null default 1,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint tracking_sessions_order_id_fkey
    foreign key (order_id)
    references public.orders (id)
    on delete restrict,
  constraint tracking_sessions_public_nonce_key unique (public_nonce),
  constraint tracking_sessions_token_version_positive check (token_version > 0),
  constraint tracking_sessions_revocation_valid check (
    revoked_at is null or revoked_at >= created_at
  ),
  constraint tracking_sessions_expiration_valid check (
    expires_at is null or expires_at >= created_at
  )
);

create index tracking_sessions_order_id_idx
on public.tracking_sessions (order_id);

create unique index tracking_sessions_active_order_key
on public.tracking_sessions (order_id)
where revoked_at is null;

alter table public.tracking_sessions enable row level security;

revoke all on table public.tracking_sessions from anon, authenticated;
revoke all on sequence public.tracking_sessions_id_seq from anon, authenticated;
