create table public.tracking_viewers (
  tracking_session_id bigint not null,
  auth_user_id uuid not null,
  topic text not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  primary key (tracking_session_id, auth_user_id),
  constraint tracking_viewers_tracking_session_id_fkey
    foreign key (tracking_session_id)
    references public.tracking_sessions (id)
    on delete restrict,
  constraint tracking_viewers_auth_user_id_fkey
    foreign key (auth_user_id)
    references auth.users (id)
    on delete cascade,
  constraint tracking_viewers_topic_not_blank check (btrim(topic) <> ''),
  constraint tracking_viewers_expiration_valid check (
    expires_at is null or expires_at >= granted_at
  ),
  constraint tracking_viewers_revocation_valid check (
    revoked_at is null or revoked_at >= granted_at
  )
);

create index tracking_viewers_auth_user_topic_idx
on public.tracking_viewers (auth_user_id, topic);

alter table public.tracking_viewers enable row level security;

revoke all on table public.tracking_viewers from anon, authenticated;
