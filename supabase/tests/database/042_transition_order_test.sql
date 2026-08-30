begin;
\ir fixtures.pgtap

select extensions.plan(12);

select tests.create_user('33333333-3333-4333-8333-333333333333', 'operator@example.com');
select tests.create_restaurant('Transition Organization', 'Transition Restaurant', '33333333-3333-4333-8333-333333333333') as restaurant_id \gset
select tests.authenticate_as('33333333-3333-4333-8333-333333333333');
set local role authenticated;

select * from public.create_order(:'restaurant_id'::bigint, 'TRANSITION-1', statement_timestamp() + interval '30 minutes', null) \gset order_
select * from public.transition_order(:'order_order_id'::bigint, 'RECEIVED', 'PREPARING') \gset preparing_
select extensions.is(:'preparing_status', 'PREPARING'::public.order_status, 'advances RECEIVED to PREPARING');
select extensions.ok(
  (select preparing_at is not null from public.orders where id = :'order_order_id'::bigint),
  'sets preparing_at once'
);

select * from public.transition_order(:'order_order_id'::bigint, 'PREPARING', 'READY') \gset ready_
select extensions.is(:'ready_status', 'READY'::public.order_status, 'advances PREPARING to READY');
select extensions.ok(
  (select ready_at is not null from public.orders where id = :'order_order_id'::bigint),
  'sets ready_at once'
);

select * from public.transition_order(:'order_order_id'::bigint, 'READY', 'DELIVERED') \gset delivered_
select extensions.is(:'delivered_status', 'DELIVERED'::public.order_status, 'advances READY to DELIVERED');
select extensions.ok(
  (select delivered_at is not null from public.orders where id = :'order_order_id'::bigint),
  'sets delivered_at once'
);
select extensions.is(
  (
    select sessions.expires_at = orders.delivered_at + interval '24 hours'
    from public.tracking_sessions as sessions
    join public.orders as orders on orders.id = sessions.order_id
    where sessions.order_id = :'order_order_id'::bigint
  ),
  true,
  'expires delivered tracking after exactly 24 hours'
);

select * from public.transition_order(:'order_order_id'::bigint, 'READY', 'DELIVERED') \gset repeated_
select extensions.is(:'repeated_idempotent'::boolean, true, 'returns idempotent for an exact retry');
select extensions.is(:'repeated_version'::bigint, :'delivered_version'::bigint, 'does not increment the version for a retry');
select extensions.is(
  (select count(*) from public.order_status_history where order_id = :'order_order_id'::bigint),
  4::bigint,
  'does not add history for a retry'
);

select * from public.create_order(:'restaurant_id'::bigint, 'TRANSITION-2', statement_timestamp() + interval '30 minutes', null) \gset invalid_
select extensions.throws_ok(
  format('select * from public.transition_order(%s, %L::public.order_status, %L::public.order_status)', :'invalid_order_id', 'RECEIVED', 'READY'),
  'P0001',
  'INVALID_TRANSITION',
  'rejects a skipped transition'
);
select extensions.throws_ok(
  format('select * from public.transition_order(%s, %L::public.order_status, %L::public.order_status)', :'order_order_id', 'RECEIVED', 'PREPARING'),
  'P0001',
  'CONFLICT',
  'rejects a stale transition after a final state'
);

reset role;
select * from extensions.finish();
rollback;
