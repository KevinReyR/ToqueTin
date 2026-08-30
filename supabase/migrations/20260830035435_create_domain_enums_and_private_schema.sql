create schema private;

revoke all on schema private from public, anon, authenticated;

alter default privileges for role postgres in schema private
revoke all on tables from public, anon, authenticated;

alter default privileges for role postgres in schema private
revoke all on sequences from public, anon, authenticated;

alter default privileges for role postgres in schema private
revoke all on functions from public, anon, authenticated;

alter default privileges for role postgres in schema private
revoke all on types from public, anon, authenticated;

create type public.order_status as enum (
  'RECEIVED',
  'PREPARING',
  'READY',
  'DELIVERED',
  'CANCELLED'
);

create type public.cancellation_reason_code as enum (
  'CUSTOMER_REQUEST',
  'PRODUCT_UNAVAILABLE',
  'ORDER_ERROR',
  'OPERATIONAL_ISSUE',
  'OTHER'
);

create type public.restaurant_user_role as enum ('OPERATOR');

create type private.notification_status as enum (
  'PENDING',
  'SENT',
  'FAILED',
  'EXPIRED'
);

create type private.notification_kind as enum ('ORDER_READY');
