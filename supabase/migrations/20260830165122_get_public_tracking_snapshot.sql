create function public.get_public_tracking_snapshot(
  p_public_nonce uuid,
  p_auth_user_id uuid
)
returns table (
  restaurant_name text,
  order_number text,
  status public.order_status,
  estimated_ready_at timestamptz,
  estimate_updated_at timestamptz,
  pickup_instructions text,
  cancellation_reason text,
  tracking_expires_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    restaurants.name,
    orders.order_number,
    orders.status,
    orders.estimated_ready_at,
    orders.estimate_updated_at,
    orders.pickup_instructions,
    case orders.cancellation_reason_code
      when 'CUSTOMER_REQUEST' then 'Solicitud del cliente'
      when 'PRODUCT_UNAVAILABLE' then 'Producto no disponible'
      when 'ORDER_ERROR' then 'Error en el pedido'
      when 'OPERATIONAL_ISSUE' then 'Problema operativo'
      when 'OTHER' then orders.cancellation_reason_text
      else null
    end,
    sessions.expires_at,
    orders.updated_at
  from public.tracking_sessions as sessions
  join public.tracking_viewers as viewers
    on viewers.tracking_session_id = sessions.id
  join public.orders as orders
    on orders.id = sessions.order_id
  join public.restaurants as restaurants
    on restaurants.id = orders.restaurant_id
  join auth.users as users
    on users.id = viewers.auth_user_id
  where sessions.public_nonce = p_public_nonce
    and viewers.auth_user_id = p_auth_user_id
    and users.is_anonymous
    and sessions.revoked_at is null
    and viewers.revoked_at is null
    and (sessions.expires_at is null or sessions.expires_at > statement_timestamp())
    and (viewers.expires_at is null or viewers.expires_at > statement_timestamp());
$$;

revoke execute on function public.get_public_tracking_snapshot(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.get_public_tracking_snapshot(uuid, uuid)
to service_role;
