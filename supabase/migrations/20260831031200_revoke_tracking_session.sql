grant update (revoked_at) on table public.tracking_sessions to authenticated;

drop policy tracking_sessions_operator_update
on public.tracking_sessions;

create policy tracking_sessions_operator_update
on public.tracking_sessions
for update
to authenticated
using (
  public.is_operator_identity()
  and exists (
    select 1
    from public.orders
    where orders.id = tracking_sessions.order_id
      and public.has_active_restaurant_membership(orders.restaurant_id)
  )
)
with check (
  public.is_operator_identity()
  and exists (
    select 1
    from public.orders
    where orders.id = tracking_sessions.order_id
      and public.has_active_restaurant_membership(orders.restaurant_id)
  )
);

create function private.enforce_tracking_revocation_monotonic()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if old.revoked_at is not null
    and new.revoked_at is distinct from old.revoked_at then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_tracking_revocation_monotonic()
from public, anon, authenticated, service_role;

create trigger enforce_tracking_revocation_monotonic_before_update
before update of revoked_at on public.tracking_sessions
for each row
execute function private.enforce_tracking_revocation_monotonic();

create function private.propagate_tracking_revocation()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.tracking_viewers
  set revoked_at = new.revoked_at
  where tracking_session_id = new.id
    and (revoked_at is null or revoked_at > new.revoked_at);

  update private.tracking_push_subscriptions
  set disabled_at = case
    when disabled_at is null or disabled_at > new.revoked_at then new.revoked_at
    else disabled_at
  end
  where tracking_session_id = new.id;

  begin
    perform realtime.send(
      jsonb_build_object('type', 'TRACKING_REVOKED'),
      'tracking_revoked',
      'tracking:' || new.public_nonce::text,
      true
    );
  exception when others then
    raise warning 'Tracking revocation broadcast failed';
  end;

  return new;
end;
$$;

revoke all on function private.propagate_tracking_revocation()
from public, anon, authenticated, service_role;

create trigger propagate_tracking_revocation_after_update
after update of revoked_at on public.tracking_sessions
for each row
when (old.revoked_at is null and new.revoked_at is not null)
execute function private.propagate_tracking_revocation();

create function public.revoke_tracking_session(p_order_id bigint)
returns table (
  order_id bigint,
  revoked_at timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_revoked_at timestamptz := statement_timestamp();
  v_session public.tracking_sessions%rowtype;
begin
  if p_order_id is null
    or v_actor_id is null
    or not public.is_operator_identity() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select sessions.*
  into v_session
  from public.tracking_sessions as sessions
  join public.orders as orders on orders.id = sessions.order_id
  where sessions.order_id = p_order_id
    and public.has_active_restaurant_membership(orders.restaurant_id)
  for update of sessions;

  if not found then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_session.revoked_at is not null then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  update public.tracking_sessions
  set revoked_at = v_revoked_at
  where id = v_session.id;

  return query select v_session.order_id, v_revoked_at;
end;
$$;

revoke execute on function public.revoke_tracking_session(bigint)
from public, anon, service_role;
grant execute on function public.revoke_tracking_session(bigint)
to authenticated;
