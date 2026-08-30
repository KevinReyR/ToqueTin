begin;
\ir fixtures.pgtap

select extensions.plan(10);

select tests.create_user('11111111-1111-4111-8111-111111111111', 'operator-one@example.com');
select tests.create_user('22222222-2222-4222-8222-222222222222', 'operator-two@example.com');
select tests.create_restaurant('Organization One', 'Restaurant One', '11111111-1111-4111-8111-111111111111') as restaurant_one_id \gset
select tests.create_restaurant('Organization Two', 'Restaurant Two', '22222222-2222-4222-8222-222222222222') as restaurant_two_id \gset

select tests.authenticate_as('11111111-1111-4111-8111-111111111111');
set local role authenticated;

select *
from public.create_order(
  :'restaurant_one_id'::bigint,
  ' A-17 ',
  statement_timestamp() + interval '20 minutes',
  'Recoge en el mostrador'
) \gset created_

select extensions.is(:'created_status', 'RECEIVED'::public.order_status, 'creates orders as RECEIVED');
select extensions.is(:'created_order_number'::text, 'A-17'::text, 'stores a trimmed visible order number');
select extensions.ok(:'created_tracking_public_nonce'::uuid is not null, 'returns a tracking nonce');
select extensions.is(
  (select count(*) from public.order_status_history where order_id = :'created_order_id'::bigint),
  1::bigint,
  'records exactly one initial history event'
);
select extensions.is(
  (select count(*) from public.tracking_sessions where order_id = :'created_order_id'::bigint),
  1::bigint,
  'creates exactly one tracking session'
);
select extensions.throws_ok(
  format(
    'select * from public.create_order(%s, %L, statement_timestamp() + interval ''20 minutes'', null)',
    :'restaurant_one_id',
    'a-17'
  ),
  '23505',
  'duplicate key value violates unique constraint "orders_restaurant_day_number_key"',
  'rejects a normalized duplicate in the same restaurant and journey'
);

reset role;
select tests.authenticate_as('22222222-2222-4222-8222-222222222222');
set local role authenticated;

select extensions.lives_ok(
  format(
    'select * from public.create_order(%s, %L, statement_timestamp() + interval ''20 minutes'', null)',
    :'restaurant_two_id',
    'A-17'
  ),
  'allows the same number in another restaurant'
);

reset role;
create function tests.fail_tracking_insert()
returns trigger
language plpgsql
as $$
begin
  raise exception 'forced tracking failure';
end;
$$;
create trigger fail_tracking_insert
before insert on public.tracking_sessions
for each row execute function tests.fail_tracking_insert();

select tests.authenticate_as('11111111-1111-4111-8111-111111111111');
set local role authenticated;
select extensions.throws_ok(
  format(
    'select * from public.create_order(%s, %L, statement_timestamp() + interval ''20 minutes'', null)',
    :'restaurant_one_id',
    'ROLLBACK-1'
  ),
  'P0001',
  'forced tracking failure',
  'propagates a tracking insertion failure'
);
select extensions.is(
  (select count(*) from public.orders where order_number = 'ROLLBACK-1'),
  0::bigint,
  'rolls back the order when tracking creation fails'
);
select extensions.is(
  (select count(*) from public.order_status_history where order_id not in (select id from public.orders)),
  0::bigint,
  'leaves no orphaned history after rollback'
);

reset role;
select * from extensions.finish();
rollback;
