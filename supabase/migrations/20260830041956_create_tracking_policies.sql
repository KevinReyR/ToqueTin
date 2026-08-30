grant select on table public.tracking_sessions, public.tracking_viewers
to authenticated;

create policy tracking_sessions_operator_select
on public.tracking_sessions
for select
to authenticated
using (
  public.is_operator_identity()
  and exists (
    select 1
    from public.orders
    where orders.id = tracking_sessions.order_id
      and public.has_active_restaurant_membership(orders.restaurant_id)
  )
);

create policy tracking_sessions_viewer_select
on public.tracking_sessions
for select
to authenticated
using (
  public.is_anonymous_identity()
  and revoked_at is null
  and (expires_at is null or expires_at > now())
  and exists (
    select 1
    from public.tracking_viewers
    where tracking_session_id = tracking_sessions.id
      and auth_user_id = (select auth.uid())
      and revoked_at is null
      and (expires_at is null or expires_at > now())
  )
);

create policy tracking_viewers_anonymous_select_own_active
on public.tracking_viewers
for select
to authenticated
using (
  public.is_anonymous_identity()
  and auth_user_id = (select auth.uid())
  and revoked_at is null
  and (expires_at is null or expires_at > now())
);
