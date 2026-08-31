create or replace function public.register_push_subscription(
  p_auth_user_id uuid,
  p_endpoint text,
  p_p256dh_key text,
  p_auth_key text,
  p_endpoint_digest text,
  p_expires_at timestamptz
)
returns table (push_subscription_id bigint)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_existing private.push_subscriptions%rowtype;
  v_subscription_id bigint;
begin
  if p_auth_user_id is null
    or not exists (
      select 1
      from auth.users
      where users.id = p_auth_user_id
        and users.is_anonymous is true
    )
    or btrim(coalesce(p_endpoint, '')) = ''
    or btrim(coalesce(p_p256dh_key, '')) = ''
    or btrim(coalesce(p_auth_key, '')) = ''
    or p_endpoint_digest !~ '^[0-9a-f]{64}$'
    or (p_expires_at is not null and p_expires_at <= v_now) then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  select subscriptions.*
  into v_existing
  from private.push_subscriptions as subscriptions
  where subscriptions.endpoint_digest = p_endpoint_digest
  for update;

  if found and v_existing.auth_user_id <> p_auth_user_id then
    update private.tracking_push_subscriptions as associations
    set disabled_at = greatest(associations.enabled_at, v_now)
    where associations.push_subscription_id = v_existing.id
      and associations.disabled_at is null;
  end if;

  insert into private.push_subscriptions (
    auth_user_id,
    endpoint,
    p256dh_key,
    auth_key,
    endpoint_digest,
    expires_at,
    revoked_at,
    last_error_code,
    updated_at
  ) values (
    p_auth_user_id,
    btrim(p_endpoint),
    btrim(p_p256dh_key),
    btrim(p_auth_key),
    p_endpoint_digest,
    p_expires_at,
    null,
    null,
    v_now
  )
  on conflict (endpoint_digest) do update
  set auth_user_id = excluded.auth_user_id,
      endpoint = excluded.endpoint,
      p256dh_key = excluded.p256dh_key,
      auth_key = excluded.auth_key,
      expires_at = excluded.expires_at,
      revoked_at = null,
      last_error_code = null,
      updated_at = v_now
  returning id into v_subscription_id;

  return query select v_subscription_id;
end;
$$;
