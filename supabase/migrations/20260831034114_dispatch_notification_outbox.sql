create function public.claim_ready_notifications(p_limit integer default 25)
returns table (
  notification_id bigint,
  attempt_count smallint,
  endpoint text,
  p256dh_key text,
  auth_key text,
  public_nonce uuid
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_item record;
  v_attempt_count smallint;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  for v_item in
    select
      notifications.id,
      notifications.attempt_count,
      orders.status as order_status,
      sessions.public_nonce,
      sessions.revoked_at as tracking_revoked_at,
      sessions.expires_at as tracking_expires_at,
      associations.disabled_at,
      subscriptions.endpoint,
      subscriptions.p256dh_key,
      subscriptions.auth_key,
      subscriptions.revoked_at as subscription_revoked_at,
      subscriptions.expires_at as subscription_expires_at
    from private.notifications as notifications
    join public.orders as orders on orders.id = notifications.order_id
    join public.tracking_sessions as sessions
      on sessions.id = notifications.tracking_session_id
    join private.tracking_push_subscriptions as associations
      on associations.tracking_session_id = notifications.tracking_session_id
      and associations.push_subscription_id = notifications.push_subscription_id
    join private.push_subscriptions as subscriptions
      on subscriptions.id = notifications.push_subscription_id
    where notifications.status in ('PENDING', 'FAILED')
      and notifications.attempt_count < 3
      and notifications.next_attempt_at <= v_now
    order by notifications.next_attempt_at, notifications.id
    for update of notifications skip locked
    limit p_limit
  loop
    if v_item.order_status <> 'READY'
      or v_item.tracking_revoked_at is not null
      or (v_item.tracking_expires_at is not null and v_item.tracking_expires_at <= v_now)
      or v_item.disabled_at is not null
      or v_item.subscription_revoked_at is not null
      or (v_item.subscription_expires_at is not null and v_item.subscription_expires_at <= v_now) then
      update private.notifications
      set status = 'EXPIRED',
          last_error_code = 'NOTIFICATION_EXPIRED',
          updated_at = v_now
      where id = v_item.id;
      continue;
    end if;

    v_attempt_count := v_item.attempt_count + 1;
    update private.notifications
    set attempt_count = v_attempt_count,
        status = 'FAILED',
        next_attempt_at = case v_attempt_count
          when 1 then v_now + interval '1 minute'
          when 2 then v_now + interval '5 minutes'
          else v_now
        end,
        last_error_code = 'DISPATCH_PENDING',
        updated_at = v_now
    where id = v_item.id;

    notification_id := v_item.id;
    attempt_count := v_attempt_count;
    endpoint := v_item.endpoint;
    p256dh_key := v_item.p256dh_key;
    auth_key := v_item.auth_key;
    public_nonce := v_item.public_nonce;
    return next;
  end loop;
end;
$$;

revoke execute on function public.claim_ready_notifications(integer)
from public, anon, authenticated;
grant execute on function public.claim_ready_notifications(integer)
to service_role;

create function public.record_notification_delivery(
  p_notification_id bigint,
  p_outcome text,
  p_error_code text default null
)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_notification private.notifications%rowtype;
  v_error_code text := nullif(btrim(p_error_code), '');
begin
  if p_notification_id is null
    or p_outcome not in ('SENT', 'FAILED', 'EXPIRED')
    or (v_error_code is not null and v_error_code !~ '^[A-Z0-9_]{1,64}$') then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  select notifications.*
  into v_notification
  from private.notifications as notifications
  where notifications.id = p_notification_id
  for update;

  if not found then
    return false;
  end if;

  if p_outcome = 'SENT' then
    update private.notifications
    set status = 'SENT',
        sent_at = v_now,
        last_error_code = null,
        updated_at = v_now
    where id = p_notification_id;
  elsif p_outcome = 'EXPIRED' then
    update private.notifications
    set status = 'EXPIRED',
        sent_at = null,
        last_error_code = coalesce(v_error_code, 'PUSH_EXPIRED'),
        updated_at = v_now
    where id = p_notification_id;

    update private.push_subscriptions
    set revoked_at = coalesce(revoked_at, v_now),
        last_error_code = coalesce(v_error_code, 'PUSH_EXPIRED'),
        updated_at = v_now
    where id = v_notification.push_subscription_id;

    update private.tracking_push_subscriptions
    set disabled_at = greatest(enabled_at, v_now)
    where push_subscription_id = v_notification.push_subscription_id
      and disabled_at is null;
  else
    update private.notifications
    set status = 'FAILED',
        sent_at = null,
        last_error_code = coalesce(v_error_code, 'PUSH_FAILED'),
        updated_at = v_now
    where id = p_notification_id;

    update private.push_subscriptions
    set last_error_code = coalesce(v_error_code, 'PUSH_FAILED'),
        updated_at = v_now
    where id = v_notification.push_subscription_id;
  end if;

  return true;
end;
$$;

revoke execute on function public.record_notification_delivery(bigint, text, text)
from public, anon, authenticated;
grant execute on function public.record_notification_delivery(bigint, text, text)
to service_role;
