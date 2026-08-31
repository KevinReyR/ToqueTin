begin;
\ir fixtures.pgtap

select extensions.plan(10);

select tests.create_user('55555555-5555-4555-8555-555555555555', 'tracking-operator@example.com');
select tests.create_user('66666666-6666-4666-8666-666666666666', 'tracking-viewer@example.com', true);
select tests.create_user('77777777-7777-4777-8777-777777777777', 'other-viewer@example.com', true);
select tests.create_restaurant('Tracking Organization', 'Tracking Restaurant', '55555555-5555-4555-8555-555555555555') as restaurant_id \gset

select tests.authenticate_as('55555555-5555-4555-8555-555555555555');
set local role authenticated;
select * from public.create_order(
  :'restaurant_id'::bigint,
  'TRACK-1',
  statement_timestamp() + interval '30 minutes',
  'Retira en el mostrador'
) \gset created_
reset role;

set local role service_role;
select * from public.grant_tracking_viewer(
  :'created_tracking_public_nonce'::uuid,
  '66666666-6666-4666-8666-666666666666'
) \gset grant_
select extensions.is(
  :'grant_topic'::text,
  ('tracking:' || :'created_tracking_public_nonce')::text,
  'grants only the deterministic topic for the tracking nonce'
);
select extensions.is(
  (select count(*) from public.tracking_viewers where tracking_session_id = (select id from public.tracking_sessions where public_nonce = :'created_tracking_public_nonce'::uuid)),
  1::bigint,
  'creates one tracking viewer grant'
);

select * from public.grant_tracking_viewer(
  :'created_tracking_public_nonce'::uuid,
  '66666666-6666-4666-8666-666666666666'
);
select extensions.is(
  (select count(*) from public.tracking_viewers where tracking_session_id = (select id from public.tracking_sessions where public_nonce = :'created_tracking_public_nonce'::uuid)),
  1::bigint,
  'reuses a viewer grant idempotently'
);
select extensions.is(
  (select count(*) from public.get_public_tracking_snapshot(
    :'created_tracking_public_nonce'::uuid,
    '66666666-6666-4666-8666-666666666666'
  )),
  1::bigint,
  'returns one public snapshot for the granted viewer'
);
select extensions.is(
  (select restaurant_name from public.get_public_tracking_snapshot(
    :'created_tracking_public_nonce'::uuid,
    '66666666-6666-4666-8666-666666666666'
  )),
  'Tracking Restaurant'::text,
  'projects the restaurant name without internal identifiers'
);
select extensions.is(
  (select cancellation_reason from public.get_public_tracking_snapshot(
    :'created_tracking_public_nonce'::uuid,
    '66666666-6666-4666-8666-666666666666'
  )),
  null::text,
  'projects only the allowed public fields before cancellation'
);
select extensions.is(
  (select count(*) from public.get_public_tracking_snapshot(
    :'created_tracking_public_nonce'::uuid,
    '77777777-7777-4777-8777-777777777777'
  )),
  0::bigint,
  'does not return a snapshot to a different viewer'
);

update public.tracking_sessions
set expires_at = created_at
where public_nonce = :'created_tracking_public_nonce'::uuid;
select extensions.is(
  (select count(*) from public.grant_tracking_viewer(
    :'created_tracking_public_nonce'::uuid,
    '77777777-7777-4777-8777-777777777777'
  )),
  0::bigint,
  'does not grant expired tracking'
);
select extensions.is(
  (select count(*) from public.get_public_tracking_snapshot(
    :'created_tracking_public_nonce'::uuid,
    '66666666-6666-4666-8666-666666666666'
  )),
  0::bigint,
  'does not project expired tracking'
);
reset role;

select tests.authenticate_as('66666666-6666-4666-8666-666666666666', true);
set local role authenticated;
select extensions.throws_ok(
  format(
    'select * from public.get_public_tracking_snapshot(%L::uuid, %L::uuid)',
    :'created_tracking_public_nonce',
    '66666666-6666-4666-8666-666666666666'
  ),
  '42501',
  null,
  'does not expose the privileged snapshot function to anonymous clients'
);
reset role;

select * from extensions.finish();
rollback;
