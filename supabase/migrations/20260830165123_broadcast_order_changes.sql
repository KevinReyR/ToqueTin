create function private.broadcast_order_change()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event_type text;
  v_tracking_nonce uuid;
begin
  if tg_op = 'UPDATE' and new.version = old.version then
    return new;
  end if;

  v_event_type := case
    when tg_op = 'INSERT' then 'ORDER_CREATED'
    when new.status is distinct from old.status then 'STATUS_CHANGED'
    when new.estimated_ready_at is distinct from old.estimated_ready_at
      then 'ESTIMATE_UPDATED'
    else 'ORDER_UPDATED'
  end;

  select sessions.public_nonce
  into v_tracking_nonce
  from public.tracking_sessions as sessions
  where sessions.order_id = new.id
    and sessions.revoked_at is null
  limit 1;

  if v_tracking_nonce is not null then
    perform realtime.send(
      jsonb_build_object(
        'type', v_event_type,
        'version', new.version::text,
        'status', new.status::text,
        'estimatedReadyAt', new.estimated_ready_at,
        'estimateUpdatedAt', new.estimate_updated_at,
        'pickupInstructions', new.pickup_instructions,
        'cancellationReason', case new.cancellation_reason_code
          when 'CUSTOMER_REQUEST' then 'Solicitud del cliente'
          when 'PRODUCT_UNAVAILABLE' then 'Producto no disponible'
          when 'ORDER_ERROR' then 'Error en el pedido'
          when 'OPERATIONAL_ISSUE' then 'Problema operativo'
          when 'OTHER' then new.cancellation_reason_text
          else null
        end,
        'updatedAt', new.updated_at
      ),
      'order_changed',
      'tracking:' || v_tracking_nonce::text,
      true
    );
  end if;

  perform realtime.send(
    jsonb_build_object(
      'type', v_event_type,
      'version', new.version::text,
      'orderId', new.id::text,
      'status', new.status::text,
      'estimatedReadyAt', new.estimated_ready_at,
      'estimateUpdatedAt', new.estimate_updated_at,
      'updatedAt', new.updated_at
    ),
    'order_changed',
    'restaurant:' || new.restaurant_id::text,
    true
  );

  return new;
end;
$$;

revoke all on function private.broadcast_order_change() from public;

create trigger broadcast_order_change_after_commit
after insert or update on public.orders
for each row
execute function private.broadcast_order_change();
