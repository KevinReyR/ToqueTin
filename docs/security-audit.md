# Auditoría de seguridad del MVP

Fecha: 2026-08-31

## Alcance

La revisión cubre el código de navegador y servidor, migraciones, políticas RLS, autorización Realtime, respuestas públicas, pruebas, configuración versionada y artefactos de compilación. La instancia remota de Supabase no forma parte de esta ejecución; las migraciones se validaron contra Supabase local.

## Resultado

- Las diez tablas de aplicación en los esquemas `public` y `private` tienen RLS habilitado.
- Los dos canales privados de `realtime.messages` autorizan únicamente el tópico exacto de tracking vigente o el restaurante con membresía activa.
- `private` no está expuesto por la Data API y sus tablas no conceden acceso general a `anon` ni `authenticated`.
- El acceso público devuelve únicamente `PublicTrackingSnapshot`; no contiene IDs internos, actores, tokens, cookies, endpoints de Push ni PII.
- La credencial firmada se recibe en el fragmento, se elimina de la URL antes del intercambio y no se persiste. Las respuestas de tracking usan `private, no-store` y errores 404 no enumerables.
- `SUPABASE_SERVICE_ROLE_KEY`, `TRACKING_TOKEN_HMAC_SECRET` y `VAPID_PRIVATE_KEY` se validan solo en módulos `server-only`. El navegador recibe únicamente las variables públicas previstas.
- Los Broadcasts de tracking y restaurante usan payloads mínimos y no publican tokens, endpoints, actores, organización, historial ni filas completas.
- La revisión de índices confirmó soporte para membresía, jornada/estado, historial, tracking y outbox.
- `supabase db lint` y los advisors locales de seguridad y rendimiento finalizaron sin hallazgos.

## Evidencia reproducible

```text
pnpm exec supabase db lint --local
pnpm exec supabase db advisors --local --type security
pnpm exec supabase db advisors --local --type performance
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
```

La auditoría de secretos busca nombres y valores de prueba en `.next/static`, respuestas capturadas, resultados Playwright y el diff versionado. La salida de `supabase status` se consume en memoria por las pruebas y no se imprime ni se guarda.

## Riesgos operativos controlados

- Web Push depende de claves VAPID y disponibilidad del navegador; su ausencia no bloquea el tracking ni el aviso visual obligatorio.
- El despliegue remoto requiere aplicar las migraciones por el flujo de entrega del proyecto. Esta tarea no ejecuta `supabase db push`.
- La rotación y custodia de secretos corresponde al entorno de despliegue; el repositorio contiene solo placeholders en `.env.example`.
