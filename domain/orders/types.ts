export const ORDER_STATUSES = [
  "RECEIVED",
  "PREPARING",
  "READY",
  "DELIVERED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const CANCELLATION_REASON_CODES = [
  "CUSTOMER_REQUEST",
  "PRODUCT_UNAVAILABLE",
  "ORDER_ERROR",
  "OPERATIONAL_ISSUE",
  "OTHER",
] as const;

export type CancellationReasonCode = (typeof CANCELLATION_REASON_CODES)[number];

export const NOTIFICATION_STATUSES = [
  "PENDING",
  "SENT",
  "FAILED",
  "EXPIRED",
] as const;

export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const NOTIFICATION_KINDS = ["ORDER_READY"] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const RESTAURANT_USER_ROLES = ["OPERATOR"] as const;

export type RestaurantUserRole = (typeof RESTAURANT_USER_ROLES)[number];
