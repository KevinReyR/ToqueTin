import type { ApplicationErrorCode } from "@/shared/errors";

export const ERROR_MESSAGES: Record<ApplicationErrorCode, string> = {
  AUTHENTICATION_REQUIRED: "Inicia sesión para continuar.",
  INVALID_CREDENTIALS: "El correo o la contraseña no son válidos.",
  FORBIDDEN: "No tienes permiso para realizar esta acción.",
  VALIDATION_ERROR: "Revisa los datos ingresados e inténtalo de nuevo.",
  DUPLICATE_ORDER_NUMBER:
    "Ese número de pedido ya existe en la jornada seleccionada.",
  INVALID_TRANSITION: "El pedido no puede cambiar a ese estado.",
  CONFLICT:
    "El pedido cambió mientras lo actualizabas. Revisa su estado actual.",
  CANCELLATION_REASON_REQUIRED: "Selecciona un motivo de cancelación válido.",
  ESTIMATE_LOCKED: "La estimación ya no puede modificarse en este estado.",
  TRACKING_INVALID: "El enlace de seguimiento no es válido.",
  TRACKING_EXPIRED: "El enlace de seguimiento ya venció.",
  TRACKING_REVOKED: "El enlace de seguimiento ya no está disponible.",
  PERMISSION_UNAVAILABLE:
    "No fue posible activar este permiso. Puedes seguir el pedido aquí.",
};
