revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

revoke all on table private.push_subscriptions,
  private.tracking_push_subscriptions,
  private.notifications
from service_role;
revoke all on sequence private.push_subscriptions_id_seq,
  private.notifications_id_seq
from service_role;

grant usage on schema private to service_role;
grant select, insert, update on table private.push_subscriptions,
  private.tracking_push_subscriptions
to service_role;
grant select, update on table private.notifications to service_role;
grant usage, select on sequence private.push_subscriptions_id_seq to service_role;
