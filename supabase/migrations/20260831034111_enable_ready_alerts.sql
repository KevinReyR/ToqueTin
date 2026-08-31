create function public.enable_ready_alerts(
  p_public_nonce uuid,
  p_auth_user_id uuid,
  p_endpoint text,
  p_p256dh_key text,
  p_auth_key text,
  p_endpoint_digest text,
  p_expires_at timestamptz
)
returns table (push_enabled boolean)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_tracking_session_id bigint;
  v_push_subscription_id bigint;
begin
  select sessions.id
  into v_tracking_session_id
  from public.tracking_sessions as sessions
  join public.tracking_viewers as viewers
    on viewers.tracking_session_id = sessions.id
  where sessions.public_nonce = p_public_nonce
    and viewers.auth_user_id = p_auth_user_id
    and sessions.revoked_at is null
    and viewers.revoked_at is null
    and (sessions.expires_at is null or sessions.expires_at > v_now)
    and (viewers.expires_at is null or viewers.expires_at > v_now)
  for update of sessions;

  if not found then
    return;
  end if;

  select registration.push_subscription_id
  into v_push_subscription_id
  from public.register_push_subscription(
    p_auth_user_id,
    p_endpoint,
    p_p256dh_key,
    p_auth_key,
    p_endpoint_digest,
    p_expires_at
  ) as registration;

  insert into private.tracking_push_subscriptions (
    tracking_session_id,
    push_subscription_id,
    enabled_at,
    disabled_at
  ) values (
    v_tracking_session_id,
    v_push_subscription_id,
    v_now,
    null
  )
  on conflict (tracking_session_id, push_subscription_id) do update
  set enabled_at = v_now,
      disabled_at = null;

  return query select true;
end;
$$;

revoke execute on function public.enable_ready_alerts(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.enable_ready_alerts(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz
) to service_role;
