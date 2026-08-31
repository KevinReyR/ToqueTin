begin;
\ir fixtures.pgtap

select extensions.plan(16);

select tests.create_user('77777777-7777-4777-8777-777777777777', 'dashboard-one@example.com');
select tests.create_user('88888888-8888-4888-8888-888888888888', 'dashboard-two@example.com');
select tests.create_restaurant('Dashboard Organization One', 'Dashboard Restaurant One', '77777777-7777-4777-8777-777777777777', 'America/Bogota', time '06:00') as restaurant_one_id \gset
select tests.create_restaurant('Dashboard Organization Two', 'Dashboard Restaurant Two', '88888888-8888-4888-8888-888888888888') as restaurant_two_id \gset

insert into public.orders (
  restaurant_id, operational_day_started_at, operational_day_ended_at,
  order_number, order_number_normalized, status, estimated_ready_at,
  estimate_updated_at, preparing_at, ready_at, delivered_at, cancelled_at,
  cancellation_reason_code, created_by, updated_by, created_at, updated_at
) values
  (:'restaurant_one_id', '2026-08-31 11:00Z', '2026-09-01 11:00Z', 'D-1', 'D-1', 'RECEIVED', '2026-08-31 12:00Z', '2026-08-31 11:10Z', null, null, null, null, null, '77777777-7777-4777-8777-777777777777', '77777777-7777-4777-8777-777777777777', '2026-08-31 11:10Z', '2026-08-31 11:10Z'),
  (:'restaurant_one_id', '2026-08-31 11:00Z', '2026-09-01 11:00Z', 'D-2', 'D-2', 'DELIVERED', '2026-08-31 12:10Z', '2026-08-31 11:20Z', '2026-08-31 12:00Z', '2026-08-31 12:10Z', '2026-08-31 12:15Z', null, null, '77777777-7777-4777-8777-777777777777', '77777777-7777-4777-8777-777777777777', '2026-08-31 11:20Z', '2026-08-31 12:15Z'),
  (:'restaurant_one_id', '2026-08-31 11:00Z', '2026-09-01 11:00Z', 'D-3', 'D-3', 'CANCELLED', '2026-08-31 13:00Z', '2026-08-31 11:30Z', null, null, null, '2026-08-31 11:40Z', 'CUSTOMER_REQUEST', '77777777-7777-4777-8777-777777777777', '77777777-7777-4777-8777-777777777777', '2026-08-31 11:30Z', '2026-08-31 11:40Z'),
  (:'restaurant_one_id', '2026-08-30 11:00Z', '2026-08-31 11:00Z', 'CROSS', 'CROSS', 'READY', '2026-08-31 11:05Z', '2026-08-30 12:00Z', '2026-08-31 10:55Z', '2026-08-31 11:05Z', null, null, null, '77777777-7777-4777-8777-777777777777', '77777777-7777-4777-8777-777777777777', '2026-08-30 12:00Z', '2026-08-31 11:05Z'),
  (:'restaurant_two_id', '2026-08-31 05:00Z', '2026-09-01 05:00Z', 'FOREIGN', 'FOREIGN', 'RECEIVED', '2026-08-31 13:00Z', '2026-08-31 12:00Z', null, null, null, null, null, '88888888-8888-4888-8888-888888888888', '88888888-8888-4888-8888-888888888888', '2026-08-31 12:00Z', '2026-08-31 12:00Z');

select tests.authenticate_as('77777777-7777-4777-8777-777777777777');
set local role authenticated;

select * from public.get_dashboard_summary(:'restaurant_one_id', '2026-08-31 11:00Z', '2026-09-01 11:00Z') \gset summary_
select extensions.is(:'summary_restaurant_id'::bigint, :'restaurant_one_id'::bigint, 'binds the summary to one restaurant');
select extensions.is(:'summary_operational_day_started_at'::timestamptz, '2026-08-31 11:00Z'::timestamptz, 'uses the selected custom-cutoff journey');
select extensions.is(jsonb_array_length(:'summary_orders'::jsonb), 3, 'lists only orders created in the selected journey');
select extensions.is((:'summary_order_count_by_status'::jsonb ->> 'RECEIVED')::integer, 1, 'counts received orders');
select extensions.is((:'summary_order_count_by_status'::jsonb ->> 'DELIVERED')::integer, 1, 'counts delivered orders');
select extensions.is((:'summary_order_count_by_status'::jsonb ->> 'CANCELLED')::integer, 1, 'counts cancelled orders');
select extensions.is(:'summary_total_created'::bigint, 3::bigint, 'counts all created orders');
select extensions.is(:'summary_total_active'::bigint, 1::bigint, 'counts only received, preparing and ready as active');
select extensions.is(round(:'summary_average_preparation_seconds'::numeric), 600::numeric, 'attributes preparation to the journey where READY finishes, including a crossing order');
select extensions.is(round(:'summary_average_pickup_seconds'::numeric), 300::numeric, 'attributes pickup to the journey where DELIVERED finishes');
select extensions.ok((:'summary_orders'::jsonb @> '[{"orderNumber":"D-1"}]'::jsonb), 'returns the visible order number');
select extensions.ok(not (:'summary_orders'::jsonb @> '[{"orderNumber":"CROSS"}]'::jsonb), 'keeps a crossing order in its creation journey list');

select extensions.throws_ok(
  format('select * from public.get_dashboard_summary(%s, %L::timestamptz, %L::timestamptz)', :'restaurant_two_id', '2026-08-31 05:00Z', '2026-09-01 05:00Z'),
  '42501', 'FORBIDDEN', 'denies another restaurant summary'
);

select extensions.is(
  (
    select average_preparation_seconds
    from public.get_dashboard_summary(:'restaurant_one_id', '2026-09-02 11:00Z', '2026-09-03 11:00Z')
  ),
  null::double precision,
  'returns null when no preparation interval finished'
);

reset role;

select tests.authenticate_as('88888888-8888-4888-8888-888888888888');
set local role authenticated;
select * from public.get_dashboard_summary(:'restaurant_two_id', '2026-08-31 05:00Z', '2026-09-01 05:00Z') \gset midnight_
select extensions.is(:'midnight_operational_day_started_at'::timestamptz, '2026-08-31 05:00Z'::timestamptz, 'represents the local midnight cutoff in UTC');
select extensions.is(:'midnight_total_created'::bigint, 1::bigint, 'counts the midnight-cutoff restaurant independently');

reset role;
select * from extensions.finish();
rollback;
