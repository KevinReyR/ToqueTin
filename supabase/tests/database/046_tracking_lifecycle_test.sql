begin;
\ir fixtures.pgtap

select extensions.plan(15);

select tests.create_user(
  '88888888-8888-4888-8888-888888888881',
  'tracking-lifecycle-a@example.com'
);
select tests.create_user(
  '88888888-8888-4888-8888-888888888882',
  'tracking-lifecycle-b@example.com'
);
select tests.create_user(
  '88888888-8888-4888-8888-888888888883',
  'tracking-lifecycle-viewer@example.com',
  true
);
select tests.create_restaurant(
  'Tracking lifecycle organization A',
  'Tracking lifecycle restaurant A',
  '88888888-8888-4888-8888-888888888881'
) as restaurant_a_id \gset
select tests.create_restaurant(
  'Tracking lifecycle organization B',
  'Tracking lifecycle restaurant B',
  '88888888-8888-4888-8888-888888888882'
) as restaurant_b_id \gset

select tests.authenticate_as('88888888-8888-4888-8888-888888888881');
set local role authenticated;
select * from public.create_order(
  :'restaurant_a_id'::bigint,
  'REVOKE-1',
  statement_timestamp() + interval '30 minutes',
  null
) \gset revoke_
reset role;

set local role service_role;
select * from public.grant_tracking_viewer(
  :'revoke_tracking_public_nonce'::uuid,
  '88888888-8888-4888-8888-888888888883'
);
reset role;

select id as revoke_session_id
from public.tracking_sessions
where order_id = :'revoke_order_id'::bigint \gset

insert into private.push_subscriptions (
  auth_user_id,
  endpoint,
  p256dh_key,
  auth_key,
  endpoint_digest
) values (
  '88888888-8888-4888-8888-888888888883',
  'https://push.example.test/revoke',
  'revoke-p256dh',
  'revoke-auth',
  'revoke-digest'
) returning id as revoke_push_id \gset

insert into private.tracking_push_subscriptions (
  tracking_session_id,
  push_subscription_id
) values (
  :'revoke_session_id'::bigint,
  :'revoke_push_id'::bigint
);

select tests.authenticate_as('88888888-8888-4888-8888-888888888882');
set local role authenticated;
select extensions.throws_ok(
  format(
    'select * from public.revoke_tracking_session(%s)',
    :'revoke_order_id'
  ),
  '42501',
  'FORBIDDEN',
  'an operator from another restaurant cannot revoke tracking'
);
reset role;

select tests.authenticate_as(
  '88888888-8888-4888-8888-888888888883',
  true
);
set local role authenticated;
select extensions.throws_ok(
  format(
    'select * from public.revoke_tracking_session(%s)',
    :'revoke_order_id'
  ),
  '42501',
  'FORBIDDEN',
  'an anonymous viewer cannot revoke tracking'
);
reset role;

select tests.authenticate_as('88888888-8888-4888-8888-888888888881');
set local role authenticated;
select * from public.revoke_tracking_session(
  :'revoke_order_id'::bigint
) \gset revoked_
select extensions.is(
  :'revoked_order_id'::bigint,
  :'revoke_order_id'::bigint,
  'the authorized operator revokes the requested order tracking'
);
reset role;

select extensions.is(
  (select revoked_at from public.tracking_sessions where id = :'revoke_session_id'::bigint),
  :'revoked_revoked_at'::timestamptz,
  'the tracking session is revoked immediately'
);
select extensions.is(
  (
    select revoked_at
    from public.tracking_viewers
    where tracking_session_id = :'revoke_session_id'::bigint
  ),
  :'revoked_revoked_at'::timestamptz,
  'viewer revocation matches the session'
);
select extensions.is(
  (
    select disabled_at
    from private.tracking_push_subscriptions
    where tracking_session_id = :'revoke_session_id'::bigint
  ),
  :'revoked_revoked_at'::timestamptz,
  'push association is disabled at the same instant'
);
select extensions.is(
  (select count(*) from public.orders where id = :'revoke_order_id'::bigint),
  1::bigint,
  'revocation preserves the order'
);
select extensions.is(
  (
    select count(*)
    from public.order_status_history
    where order_id = :'revoke_order_id'::bigint
  ),
  1::bigint,
  'revocation preserves order history without adding a state event'
);

select tests.authenticate_as('88888888-8888-4888-8888-888888888881');
set local role authenticated;
select extensions.throws_ok(
  format(
    'select * from public.revoke_tracking_session(%s)',
    :'revoke_order_id'
  ),
  'P0001',
  'CONFLICT',
  'a repeated revocation reports a conflict'
);
select extensions.throws_ok(
  format(
    'update public.tracking_sessions set revoked_at = null where id = %s',
    :'revoke_session_id'
  ),
  'P0001',
  'CONFLICT',
  'an operator cannot restore revoked tracking'
);
reset role;

select tests.authenticate_as('88888888-8888-4888-8888-888888888881');
set local role authenticated;
select * from public.create_order(
  :'restaurant_a_id'::bigint,
  'DELIVER-EXPIRY',
  statement_timestamp() + interval '30 minutes',
  null
) \gset delivered_
reset role;

set local role service_role;
select * from public.grant_tracking_viewer(
  :'delivered_tracking_public_nonce'::uuid,
  '88888888-8888-4888-8888-888888888883'
);
reset role;

select id as delivered_session_id
from public.tracking_sessions
where order_id = :'delivered_order_id'::bigint \gset

insert into private.tracking_push_subscriptions (
  tracking_session_id,
  push_subscription_id
) values (
  :'delivered_session_id'::bigint,
  :'revoke_push_id'::bigint
);

select tests.authenticate_as('88888888-8888-4888-8888-888888888881');
set local role authenticated;
select * from public.transition_order(
  :'delivered_order_id'::bigint,
  'RECEIVED',
  'PREPARING'
);
select * from public.transition_order(
  :'delivered_order_id'::bigint,
  'PREPARING',
  'READY'
);
select * from public.transition_order(
  :'delivered_order_id'::bigint,
  'READY',
  'DELIVERED'
);
reset role;

select extensions.is(
  (
    select sessions.expires_at
    from public.tracking_sessions as sessions
    where sessions.id = :'delivered_session_id'::bigint
  ),
  (
    select orders.delivered_at + interval '24 hours'
    from public.orders as orders
    where orders.id = :'delivered_order_id'::bigint
  ),
  'delivered tracking expires exactly 24 hours after delivery'
);
select extensions.is(
  (
    select viewers.expires_at
    from public.tracking_viewers as viewers
    where viewers.tracking_session_id = :'delivered_session_id'::bigint
  ),
  (
    select sessions.expires_at
    from public.tracking_sessions as sessions
    where sessions.id = :'delivered_session_id'::bigint
  ),
  'delivery expiration is copied to viewers'
);
select extensions.is(
  (
    select associations.disabled_at
    from private.tracking_push_subscriptions as associations
    where associations.tracking_session_id = :'delivered_session_id'::bigint
  ),
  (
    select sessions.expires_at
    from public.tracking_sessions as sessions
    where sessions.id = :'delivered_session_id'::bigint
  ),
  'delivery expiration is copied to push associations'
);

select tests.authenticate_as('88888888-8888-4888-8888-888888888881');
set local role authenticated;
select * from public.create_order(
  :'restaurant_a_id'::bigint,
  'CANCEL-EXPIRY',
  statement_timestamp() + interval '30 minutes',
  null
) \gset cancelled_
select * from public.cancel_order(
  :'cancelled_order_id'::bigint,
  'CUSTOMER_REQUEST',
  null
);
reset role;

select extensions.is(
  (
    select sessions.expires_at
    from public.tracking_sessions as sessions
    where sessions.order_id = :'cancelled_order_id'::bigint
  ),
  (
    select orders.cancelled_at + interval '24 hours'
    from public.orders as orders
    where orders.id = :'cancelled_order_id'::bigint
  ),
  'cancelled tracking expires exactly 24 hours after cancellation'
);
select extensions.is(
  (
    select count(*)
    from public.get_public_tracking_snapshot(
      :'revoke_tracking_public_nonce'::uuid,
      '88888888-8888-4888-8888-888888888883'
    )
  ),
  0::bigint,
  'the privileged snapshot no longer returns revoked tracking'
);

select * from extensions.finish();
rollback;
