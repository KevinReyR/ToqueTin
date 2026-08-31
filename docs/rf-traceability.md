# Matriz final de trazabilidad del MVP

Fecha de verificación: 2026-08-31

| Requisito | Implementación principal | Verificación ejecutada |
| --- | --- | --- |
| RF-1 | Creación transaccional de pedidos, formulario de operador y jornada persistida | pgTAP de creación; integración RPC; E2E de autenticación y creación; concurrencia de número duplicado |
| RF-2 | Sesión temporal, token HMAC y QR sin credencial en path/query | Unitarias de token/QR; pgTAP de grant; E2E de apertura desde fragmento y token alterado |
| RF-3 | Snapshot público limitado y tracking sin registro visible | pgTAP de proyección; integración de tracking; E2E público sin PII ni login |
| RF-4 | Matriz transaccional de transiciones e idempotencia | pgTAP de estados; integración; E2E hasta `DELIVERED`; prueba concurrente de transición |
| RF-5 | Cancelación tipada desde estados permitidos | pgTAP de motivos; componentes; E2E desde `RECEIVED` y `PREPARING` |
| RF-6 | Broadcast privado, reconexión y actualización manual | Componentes Realtime; integración; E2E de cambio automático, desconexión y reconciliación |
| RF-7 | Aviso visual obligatorio de `READY`, sonido y vibración progresivos | Unitarias de capacidades; componentes; E2E de consentimiento y jerarquía visual `READY` |
| RF-8 | Suscripción Web Push y outbox con degradación segura | pgTAP de suscripción/outbox; integración; componentes y matriz de capacidades |
| RF-9 | Historial append-only, hitos y métricas temporales | pgTAP; integración; E2E con secuencia única y timestamps; dashboard de promedios |
| RF-10 | Expiración y revocación del tracking | pgTAP de límite exacto; integración; E2E de revocación, expiración y respuesta no enumerable |
| RF-11 | Dashboard de jornada, conteos, promedios y corte diferido | pgTAP de corte `00:00` y personalizado; componentes; integración con dos restaurantes |
| RF-12 | Auth, RLS, multi-tenant y secretos solo en servidor | pgTAP de aislamiento; integración/E2E de dos operadores; lint y advisors de Supabase; auditoría de bundles |
| RF-13 | UX mobile-first, estimación e instrucciones sin PII | Componentes accesibles; matriz Playwright desktop/móvil; build de producción |

## Cobertura T110-T134

- T110-T120: consulta y aplicación del dashboard, métricas, Realtime y corte diferido.
- T121-T122: pgTAP, integración y componentes del dashboard con aislamiento.
- T123-T129: flujo principal, cancelación, conexión, multi-tenant, token, revocación y expiración mediante Playwright.
- T130: creación y transición concurrentes con dos sesiones autenticadas.
- T131-T133: suite completa, revisión de Supabase y auditoría de superficies sensibles.
- T134: esta matriz confirma implementación y prueba para RF-1 a RF-13 sin ampliar el alcance del MVP.

No se añadieron pagos, marketplace, menús, fidelización, aplicaciones nativas, POS, NFC avanzado ni predicción automática.
