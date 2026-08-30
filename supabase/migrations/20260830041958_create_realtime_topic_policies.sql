create policy realtime_tracking_viewer_receive_broadcast
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and public.is_anonymous_identity()
  and exists (
    select 1
    from public.tracking_viewers
    where auth_user_id = (select auth.uid())
      and topic = (select realtime.topic())
      and revoked_at is null
      and (expires_at is null or expires_at > now())
  )
);

create policy realtime_restaurant_operator_receive_broadcast
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and public.is_operator_identity()
  and case
    when (select realtime.topic()) ~ '^restaurant:[1-9][0-9]*$'
      then public.has_active_restaurant_membership(
        substring((select realtime.topic()) from '^restaurant:([1-9][0-9]*)$')::bigint
      )
    else false
  end
);
