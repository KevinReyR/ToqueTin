create function private.enqueue_ready_notifications()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
begin
  begin
    insert into private.notifications (
      order_id,
      tracking_session_id,
      push_subscription_id,
      kind,
      status,
      attempt_count,
      next_attempt_at,
      created_at,
      updated_at
    )
    select
      new.id,
      sessions.id,
      associations.push_subscription_id,
      'ORDER_READY'::private.notification_kind,
      'PENDING'::private.notification_status,
      0,
      v_now,
      v_now,
      v_now
    from public.tracking_sessions as sessions
    join private.tracking_push_subscriptions as associations
      on associations.tracking_session_id = sessions.id
    join private.push_subscriptions as subscriptions
      on subscriptions.id = associations.push_subscription_id
    where sessions.order_id = new.id
      and sessions.revoked_at is null
      and (sessions.expires_at is null or sessions.expires_at > v_now)
      and associations.disabled_at is null
      and subscriptions.revoked_at is null
      and (subscriptions.expires_at is null or subscriptions.expires_at > v_now)
    on conflict (order_id, push_subscription_id, kind) do nothing;
  exception when others then
    raise warning 'Ready notification enqueue failed';
  end;

  return new;
end;
$$;

revoke all on function private.enqueue_ready_notifications()
from public, anon, authenticated, service_role;

create trigger enqueue_ready_notifications_after_update
after update of status on public.orders
for each row
when (old.status is distinct from new.status and new.status = 'READY')
execute function private.enqueue_ready_notifications();
