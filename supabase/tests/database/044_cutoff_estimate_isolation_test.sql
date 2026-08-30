begin;
\ir fixtures.pgtap

select extensions.plan(12);

select tests.create_user('55555555-5555-4555-8555-555555555555', 'operator-one@example.com');
select tests.create_user('66666666-6666-4666-8666-666666666666', 'operator-two@example.com');
select tests.create_restaurant('Cutoff Organization One', 'Cutoff Restaurant One', '55555555-5555-4555-8555-555555555555') as restaurant_one_id \gset
select tests.create_restaurant('Cutoff Organization Two', 'Cutoff Restaurant Two', '66666666-6666-4666-8666-666666666666') as restaurant_two_id \gset

select tests.authenticate_as('55555555-5555-4555-8555-555555555555');
set local role authenticated;

select * from public.schedule_operational_cutoff(:'restaurant_one_id'::bigint, time '06:00') \gset cutoff_
select extensions.is(:'cutoff_day_cutoff_time'::time, time '00:00', 'keeps the current cutoff unchanged');
select extensions.is(:'cutoff_pending_day_cutoff_time'::time, time '06:00', 'schedules the requested cutoff');
select extensions.ok(
  :'cutoff_pending_cutoff_effective_at'::timestamptz >= statement_timestamp(),
  'schedules a future effective time'
);

select * from public.schedule_operational_cutoff(:'restaurant_one_id'::bigint, time '07:00') \gset replacement_
select extensions.is(:'replacement_pending_day_cutoff_time'::time, time '07:00', 'replaces a pending cutoff');

reset role;
update public.restaurants
set pending_cutoff_effective_at = statement_timestamp() - interval '1 second'
where id = :'restaurant_one_id'::bigint;
select tests.authenticate_as('55555555-5555-4555-8555-555555555555');
set local role authenticated;
select * from public.create_order(:'restaurant_one_id'::bigint, 'ESTIMATE-1', statement_timestamp() + interval '30 minutes', null) \gset order_
select extensions.is(
  (select day_cutoff_time from public.restaurants where id = :'restaurant_one_id'::bigint),
  time '07:00',
  'promotes a due cutoff before creating an order'
);

select * from public.update_order_estimate(:'order_order_id'::bigint, statement_timestamp() + interval '45 minutes') \gset received_estimate_
select extensions.ok(:'received_estimate_version'::bigint > :'order_version'::bigint, 'updates the estimate in RECEIVED');
select * from public.transition_order(:'order_order_id'::bigint, 'RECEIVED', 'PREPARING');
select extensions.lives_ok(
  format('select * from public.update_order_estimate(%s, statement_timestamp() + interval ''50 minutes'')', :'order_order_id'),
  'updates the estimate in PREPARING'
);
select * from public.transition_order(:'order_order_id'::bigint, 'PREPARING', 'READY');
select extensions.throws_ok(
  format('select * from public.update_order_estimate(%s, statement_timestamp() + interval ''60 minutes'')', :'order_order_id'),
  'P0001',
  'ESTIMATE_LOCKED',
  'rejects estimate updates after READY'
);

select extensions.throws_ok(
  format('select * from public.create_order(%s, %L, statement_timestamp() + interval ''30 minutes'', null)', :'restaurant_two_id', 'CROSS-ORDER'),
  '42501',
  'FORBIDDEN',
  'denies cross-restaurant order creation'
);
select extensions.throws_ok(
  format('select * from public.schedule_operational_cutoff(%s, time ''08:00'')', :'restaurant_two_id'),
  '42501',
  'FORBIDDEN',
  'denies cross-restaurant cutoff scheduling'
);
reset role;
select extensions.is(
  (select day_cutoff_time from public.restaurants where id = :'restaurant_two_id'::bigint),
  time '00:00',
  'keeps the foreign restaurant unchanged'
);
select tests.authenticate_as('55555555-5555-4555-8555-555555555555');
set local role authenticated;
select extensions.throws_ok(
  format('select * from public.update_order_estimate(%s, statement_timestamp() + interval ''30 minutes'')', :'order_order_id'),
  'P0001',
  'ESTIMATE_LOCKED',
  'keeps a READY estimate locked on repeated attempts'
);

reset role;
select * from extensions.finish();
rollback;
