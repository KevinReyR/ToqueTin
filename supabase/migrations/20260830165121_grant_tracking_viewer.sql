grant select (id, is_anonymous) on table auth.users to service_role;

create function public.grant_tracking_viewer(
  p_public_nonce uuid,
  p_auth_user_id uuid
)
returns table (
  public_nonce uuid,
  topic text,
  expires_at timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if p_public_nonce is null
    or p_auth_user_id is null
    or not exists (
      select 1
      from auth.users
      where id = p_auth_user_id
        and is_anonymous
    ) then
    return;
  end if;

  return query
  insert into public.tracking_viewers (
    tracking_session_id,
    auth_user_id,
    topic,
    expires_at,
    revoked_at
  )
  select
    sessions.id,
    p_auth_user_id,
    'tracking:' || sessions.public_nonce::text,
    sessions.expires_at,
    sessions.revoked_at
  from public.tracking_sessions as sessions
  where sessions.public_nonce = p_public_nonce
    and sessions.revoked_at is null
    and (sessions.expires_at is null or sessions.expires_at > statement_timestamp())
  on conflict (tracking_session_id, auth_user_id) do update
  set
    topic = excluded.topic,
    expires_at = excluded.expires_at,
    revoked_at = excluded.revoked_at
  returning
    (
      select sessions.public_nonce
      from public.tracking_sessions as sessions
      where sessions.id = tracking_viewers.tracking_session_id
    ),
    tracking_viewers.topic,
    tracking_viewers.expires_at;
end;
$$;

revoke execute on function public.grant_tracking_viewer(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.grant_tracking_viewer(uuid, uuid)
to service_role;
