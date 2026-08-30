drop policy tracking_sessions_operator_select on public.tracking_sessions;
drop policy tracking_sessions_viewer_select on public.tracking_sessions;

create policy tracking_sessions_authorized_select
on public.tracking_sessions
for select
to authenticated
using (
  (
    public.is_operator_identity()
    and exists (
      select 1
      from public.orders
      where orders.id = tracking_sessions.order_id
        and public.has_active_restaurant_membership(orders.restaurant_id)
    )
  )
  or (
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
  )
);
