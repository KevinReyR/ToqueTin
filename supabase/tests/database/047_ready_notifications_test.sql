begin;
\ir fixtures.pgtap

select extensions.plan(24);

select tests.create_user(
  '99999999-9999-4999-8999-999999999991',
  'notification-operator@example.com'
);
select tests.create_user(
  '99999999-9999-4999-8999-999999999992',
  'notification-viewer@example.com',
  true
);
select tests.create_user(
  '99999999-9999-4999-8999-999999999993',
  'notification-other-viewer@example.com',
  true
);
select tests.create_restaurant(
  'Notification organization',
  'Notification restaurant',
  '99999999-9999-4999-8999-999999999991'
) as restaurant_id \gset

select tests.authenticate_as('99999999-9999-4999-8999-999999999991');
set local role authenticated;
select * from public.create_order(
  :'restaurant_id'::bigint,
  'PUSH-RETRY',
  statement_timestamp() + interval '30 minutes',
  null
) \gset retry_
reset role;

set local role service_role;
select * from public.grant_tracking_viewer(
  :'retry_tracking_public_nonce'::uuid,
  '99999999-9999-4999-8999-999999999992'
);
select * from public.enable_ready_alerts(
  :'retry_tracking_public_nonce'::uuid,
  '99999999-9999-4999-8999-999999999992',
  'https://push.example.test/retry',
  repeat('p', 64),
  repeat('a', 32),
  repeat('1', 64),
  statement_timestamp() + interval '7 days'
) \gset enabled_
select extensions.ok(
  :'enabled_push_enabled'::boolean,
  'a valid anonymous viewer enables Web Push'
);
select extensions.is(
  (
    select count(*)
    from private.push_subscriptions
    where endpoint_digest = repeat('1', 64)
  ),
  1::bigint,
  'registration persists one private push subscription'
);
select extensions.is(
  (
    select count(*)
    from private.tracking_push_subscriptions
    where tracking_session_id = (
      select id
      from public.tracking_sessions
      where order_id = :'retry_order_id'::bigint
    )
  ),
  1::bigint,
  'registration associates the subscription with only the granted tracking'
);

select * from public.enable_ready_alerts(
  :'retry_tracking_public_nonce'::uuid,
  '99999999-9999-4999-8999-999999999992',
  'https://push.example.test/retry',
  repeat('p', 64),
  repeat('a', 32),
  repeat('1', 64),
  statement_timestamp() + interval '7 days'
);
select extensions.is(
  (select count(*) from private.push_subscriptions where endpoint_digest = repeat('1', 64)),
  1::bigint,
  'registering the same endpoint is idempotent'
);
select extensions.is(
  (
    select count(*)
    from private.tracking_push_subscriptions
    where tracking_session_id = (
      select id
      from public.tracking_sessions
      where order_id = :'retry_order_id'::bigint
    )
  ),
  1::bigint,
  'enabling the same tracking association is idempotent'
);

select extensions.is(
  (
    select count(*)
    from public.enable_ready_alerts(
      :'retry_tracking_public_nonce'::uuid,
      '99999999-9999-4999-8999-999999999993',
      'https://push.example.test/other',
      repeat('q', 64),
      repeat('b', 32),
      repeat('2', 64),
      null
    )
  ),
  0::bigint,
  'a viewer without the exact grant cannot enable alerts'
);
reset role;

select tests.authenticate_as(
  '99999999-9999-4999-8999-999999999992',
  true
);
set local role authenticated;
select extensions.throws_ok(
  format(
    'select * from public.enable_ready_alerts(%L::uuid, %L::uuid, %L, %L, %L, %L, null)',
    :'retry_tracking_public_nonce',
    '99999999-9999-4999-8999-999999999992',
    'https://push.example.test/direct',
    repeat('p', 64),
    repeat('a', 32),
    repeat('3', 64)
  ),
  '42501',
  null,
  'anonymous clients cannot invoke the privileged registration RPC directly'
);
reset role;

select tests.authenticate_as('99999999-9999-4999-8999-999999999991');
set local role authenticated;
select * from public.transition_order(
  :'retry_order_id'::bigint,
  'RECEIVED',
  'PREPARING'
);
select * from public.transition_order(
  :'retry_order_id'::bigint,
  'PREPARING',
  'READY'
);
reset role;

select extensions.is(
  (
    select count(*)
    from private.notifications
    where order_id = :'retry_order_id'::bigint
      and kind = 'ORDER_READY'
  ),
  1::bigint,
  'READY creates one idempotent outbox notification'
);
select extensions.is(
  (
    select status::text
    from private.notifications
    where order_id = :'retry_order_id'::bigint
  ),
  'PENDING'::text,
  'a new outbox item starts pending'
);
select extensions.is(
  (
    select count(*)
    from private.notifications
    where order_id = :'retry_order_id'::bigint
  ),
  1::bigint,
  'other order updates do not duplicate the READY notification'
);

set local role service_role;
select * from public.claim_ready_notifications(1) \gset first_
select extensions.is(
  :'first_attempt_count'::smallint,
  1::smallint,
  'the first dispatch claim records attempt one'
);
select extensions.is(
  (
    select next_attempt_at - updated_at
    from private.notifications
    where id = :'first_notification_id'::bigint
  ),
  interval '1 minute',
  'the first failed attempt is eligible again after one minute'
);
select extensions.ok(
  public.record_notification_delivery(
    :'first_notification_id'::bigint,
    'FAILED',
    'PUSH_UNAVAILABLE'
  ),
  'a redacted failure result is recorded'
);
select extensions.is(
  (
    select last_error_code
    from private.notifications
    where id = :'first_notification_id'::bigint
  ),
  'PUSH_UNAVAILABLE'::text,
  'the audit stores only the stable failure code'
);

update private.notifications
set next_attempt_at = statement_timestamp()
where id = :'first_notification_id'::bigint;
select * from public.claim_ready_notifications(1) \gset second_
select extensions.is(
  :'second_attempt_count'::smallint,
  2::smallint,
  'the second dispatch claim records attempt two'
);
select extensions.is(
  (
    select next_attempt_at - updated_at
    from private.notifications
    where id = :'first_notification_id'::bigint
  ),
  interval '5 minutes',
  'the second failed attempt is eligible again after five minutes'
);
select public.record_notification_delivery(
  :'first_notification_id'::bigint,
  'FAILED',
  'PUSH_REJECTED'
);

update private.notifications
set next_attempt_at = statement_timestamp()
where id = :'first_notification_id'::bigint;
select * from public.claim_ready_notifications(1) \gset third_
select extensions.is(
  :'third_attempt_count'::smallint,
  3::smallint,
  'the third dispatch claim records the final attempt'
);
select public.record_notification_delivery(
  :'first_notification_id'::bigint,
  'FAILED',
  'PUSH_REJECTED'
);
select extensions.is(
  (
    select count(*)
    from public.claim_ready_notifications(1)
    where notification_id = :'first_notification_id'::bigint
  ),
  0::bigint,
  'a notification is never claimed after three attempts'
);
select extensions.is(
  (
    select status::text
    from private.notifications
    where id = :'first_notification_id'::bigint
  ),
  'FAILED'::text,
  'the final failure remains auditable without changing the order'
);
select extensions.is(
  (select status::text from public.orders where id = :'retry_order_id'::bigint),
  'READY'::text,
  'notification failures never revert READY'
);
reset role;

select extensions.is(
  (
    select count(*)
    from cron.job
    where jobname = 'toquetin-notification-dispatch'
  ),
  1::bigint,
  'the backup dispatcher is scheduled every minute'
);
select extensions.is(
  (select schedule from cron.job where jobname = 'toquetin-notification-dispatch'),
  '* * * * *'::text,
  'the backup schedule runs once per minute'
);

update public.tracking_sessions
set revoked_at = statement_timestamp()
where order_id = :'retry_order_id'::bigint;
set local role service_role;
select extensions.is(
  (
    select count(*)
    from public.enable_ready_alerts(
      :'retry_tracking_public_nonce'::uuid,
      '99999999-9999-4999-8999-999999999992',
      'https://push.example.test/revoked',
      repeat('r', 64),
      repeat('c', 32),
      repeat('4', 64),
      null
    )
  ),
  0::bigint,
  'revoked tracking cannot enable alerts'
);
reset role;

select extensions.is(
  (select count(*) from private.notifications where order_id = :'retry_order_id'::bigint),
  1::bigint,
  'revocation preserves the notification audit record'
);

select * from extensions.finish();
rollback;
