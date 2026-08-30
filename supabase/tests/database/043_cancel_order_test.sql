begin;
\ir fixtures.pgtap

select extensions.plan(13);

select tests.create_user('44444444-4444-4444-8444-444444444444', 'operator@example.com');
select tests.create_restaurant('Cancel Organization', 'Cancel Restaurant', '44444444-4444-4444-8444-444444444444') as restaurant_id \gset
select tests.authenticate_as('44444444-4444-4444-8444-444444444444');
set local role authenticated;

select * from public.create_order(:'restaurant_id'::bigint, 'CANCEL-1', statement_timestamp() + interval '30 minutes', null) \gset received_
select * from public.cancel_order(:'received_order_id'::bigint, 'CUSTOMER_REQUEST', null) \gset cancelled_
select extensions.is(:'cancelled_status', 'CANCELLED'::public.order_status, 'cancels a RECEIVED order');
select extensions.is(
  (select cancellation_reason_code from public.orders where id = :'received_order_id'::bigint),
  'CUSTOMER_REQUEST'::public.cancellation_reason_code,
  'persists a predefined cancellation reason'
);
select extensions.is(
  (select expires_at = cancelled_at + interval '24 hours' from public.tracking_sessions join public.orders on orders.id = tracking_sessions.order_id where orders.id = :'received_order_id'::bigint),
  true,
  'expires cancelled tracking after exactly 24 hours'
);
select * from public.cancel_order(:'received_order_id'::bigint, 'CUSTOMER_REQUEST', null) \gset repeated_
select extensions.is(:'repeated_idempotent'::boolean, true, 'treats an exact cancellation retry as idempotent');

select * from public.create_order(:'restaurant_id'::bigint, 'CANCEL-2', statement_timestamp() + interval '30 minutes', null) \gset preparing_
select * from public.transition_order(:'preparing_order_id'::bigint, 'RECEIVED', 'PREPARING');
select extensions.lives_ok(
  format('select * from public.cancel_order(%s, %L::public.cancellation_reason_code, null)', :'preparing_order_id', 'PRODUCT_UNAVAILABLE'),
  'cancels a PREPARING order'
);

select * from public.create_order(:'restaurant_id'::bigint, 'CANCEL-OPERATIONAL', statement_timestamp() + interval '30 minutes', null) \gset operational_
select extensions.lives_ok(
  format('select * from public.cancel_order(%s, %L::public.cancellation_reason_code, null)', :'operational_order_id', 'OPERATIONAL_ISSUE'),
  'accepts the operational issue reason'
);

select * from public.create_order(:'restaurant_id'::bigint, 'CANCEL-ORDER-ERROR', statement_timestamp() + interval '30 minutes', null) \gset order_error_
select extensions.lives_ok(
  format('select * from public.cancel_order(%s, %L::public.cancellation_reason_code, null)', :'order_error_order_id', 'ORDER_ERROR'),
  'accepts the order error reason'
);

select * from public.create_order(:'restaurant_id'::bigint, 'CANCEL-3', statement_timestamp() + interval '30 minutes', null) \gset other_
select extensions.throws_ok(
  format('select * from public.cancel_order(%s, %L::public.cancellation_reason_code, null)', :'other_order_id', 'OTHER'),
  'P0001',
  'CANCELLATION_REASON_REQUIRED',
  'requires text for OTHER'
);
select extensions.lives_ok(
  format('select * from public.cancel_order(%s, %L::public.cancellation_reason_code, %L)', :'other_order_id', 'OTHER', 'Cliente duplicó el pedido'),
  'accepts trimmed text for OTHER'
);
select extensions.is(
  (select cancellation_reason_text from public.orders where id = :'other_order_id'::bigint),
  'Cliente duplicó el pedido'::text,
  'persists the OTHER reason text'
);

select * from public.create_order(:'restaurant_id'::bigint, 'CANCEL-4', statement_timestamp() + interval '30 minutes', null) \gset ready_
select * from public.transition_order(:'ready_order_id'::bigint, 'RECEIVED', 'PREPARING');
select * from public.transition_order(:'ready_order_id'::bigint, 'PREPARING', 'READY');
select extensions.throws_ok(
  format('select * from public.cancel_order(%s, %L::public.cancellation_reason_code, null)', :'ready_order_id', 'ORDER_ERROR'),
  'P0001',
  'INVALID_TRANSITION',
  'rejects cancellation after READY'
);
select extensions.is(
  (select status from public.orders where id = :'ready_order_id'::bigint),
  'READY'::public.order_status,
  'keeps the READY order unchanged after rejected cancellation'
);
select extensions.is(
  (select count(*) from public.order_status_history where order_id = :'ready_order_id'::bigint),
  3::bigint,
  'does not add history after rejected cancellation'
);

reset role;
select * from extensions.finish();
rollback;
