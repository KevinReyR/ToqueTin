alter table public.orders
  add constraint orders_id_restaurant_id_key
    unique (id, restaurant_id),
  add constraint orders_restaurant_day_number_key
    unique (
      restaurant_id,
      operational_day_started_at,
      order_number_normalized
    ),
  add constraint orders_operational_day_valid check (
    operational_day_ended_at > operational_day_started_at
  ),
  add constraint orders_order_number_not_blank check (
    btrim(order_number) <> ''
  ),
  add constraint orders_order_number_normalized_not_blank check (
    btrim(order_number_normalized) <> ''
  ),
  add constraint orders_estimate_after_creation check (
    estimated_ready_at > created_at
  ),
  add constraint orders_estimate_updated_after_creation check (
    estimate_updated_at >= created_at
  ),
  add constraint orders_updated_after_creation check (
    updated_at >= created_at
  ),
  add constraint orders_version_positive check (version > 0),
  add constraint orders_cancellation_reason_consistent check (
    (
      status = 'CANCELLED'
      and cancellation_reason_code is not null
      and (
        (
          cancellation_reason_code = 'OTHER'
          and nullif(btrim(cancellation_reason_text), '') is not null
        )
        or (
          cancellation_reason_code <> 'OTHER'
          and cancellation_reason_text is null
        )
      )
    )
    or (
      status <> 'CANCELLED'
      and cancellation_reason_code is null
      and cancellation_reason_text is null
    )
  ),
  add constraint orders_status_milestones_consistent check (
    case status
      when 'RECEIVED' then
        preparing_at is null
        and ready_at is null
        and delivered_at is null
        and cancelled_at is null
      when 'PREPARING' then
        preparing_at is not null
        and ready_at is null
        and delivered_at is null
        and cancelled_at is null
      when 'READY' then
        preparing_at is not null
        and ready_at is not null
        and delivered_at is null
        and cancelled_at is null
      when 'DELIVERED' then
        preparing_at is not null
        and ready_at is not null
        and delivered_at is not null
        and cancelled_at is null
      when 'CANCELLED' then
        ready_at is null
        and delivered_at is null
        and cancelled_at is not null
    end
  ),
  add constraint orders_milestone_order_valid check (
    (preparing_at is null or preparing_at >= created_at)
    and (
      ready_at is null
      or (preparing_at is not null and ready_at >= preparing_at)
    )
    and (
      delivered_at is null
      or (ready_at is not null and delivered_at >= ready_at)
    )
    and (cancelled_at is null or cancelled_at >= created_at)
  );
