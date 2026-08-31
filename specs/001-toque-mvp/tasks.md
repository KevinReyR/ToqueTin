# Tareas de implementación — MVP de ToqueTin

Este backlog se ejecuta en orden ascendente. Cada tarea está dimensionada para completarse en un máximo de 20–30 minutos y presupone que las tareas anteriores están terminadas.

## Fase 1 — Fundación

- [x] T001 [RF-1–RF-13] Inicializar la aplicación con Next.js App Router, TypeScript, Tailwind CSS, pnpm y un lockfile versionado.
  - Hecho cuando: `pnpm dev` inicia la página base y el repositorio contiene `package.json`, `pnpm-lock.yaml`, `app/` y la configuración de Tailwind.

- [x] T002 [RF-1–RF-13] Activar TypeScript estricto y aliases de importación para los módulos de la aplicación.
  - Hecho cuando: `tsconfig.json` tiene modo estricto, no permite JavaScript implícito y resuelve el alias acordado sin errores.

- [x] T003 [RF-1–RF-13] Añadir los scripts de desarrollo, producción, lint, formato y verificación de tipos definidos en `AGENTS.md`.
  - Hecho cuando: `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm format` y `pnpm typecheck` existen en `package.json` y los scripts no destructivos terminan correctamente.

- [x] T004 [RF-1–RF-13] Configurar Vitest y los scripts de tests unitarios y modo watch.
  - Hecho cuando: `pnpm test` ejecuta una prueba mínima y `pnpm test:watch` inicia Vitest en modo interactivo.

- [x] T005 [RF-1–RF-13] Configurar Testing Library y el entorno de pruebas de componentes React.
  - Hecho cuando: una prueba renderiza un componente mínimo y valida contenido accesible con Testing Library.

- [x] T006 [RF-1–RF-13] Configurar Playwright y el script `pnpm test:e2e`.
  - Hecho cuando: Playwright descubre y ejecuta una prueba de humo contra la aplicación local.

- [x] T007 [RF-1–RF-13] Inicializar la configuración local de Supabase sin aplicar todavía el esquema de negocio.
  - Hecho cuando: existe `supabase/config.toml` válido y Supabase CLI reconoce el proyecto local.

- [x] T008 [RF-1–RF-13] Crear la plantilla de variables de entorno con valores públicos y secretos separados.
  - Hecho cuando: `.env.example` documenta Supabase, HMAC y VAPID sin contener credenciales reales, y los archivos locales de secretos están ignorados por Git.

- [x] T009 [RF-1–RF-13] Implementar validación tipada de variables de entorno de servidor.
  - Hecho cuando: el arranque del servidor rechaza una variable obligatoria ausente con un error claro y ninguna clave privada puede importarse desde código cliente.

- [x] T010 [RF-2, RF-3, RF-6, RF-8, RF-10, RF-12] Implementar el cliente Supabase para navegador con la clave pública.
  - Hecho cuando: un módulo marcado para cliente crea la instancia de Supabase sin importar secretos de servidor.

- [x] T011 [RF-1, RF-4, RF-5, RF-9, RF-11, RF-12, RF-13] Implementar el cliente Supabase para Server Components, Server Actions y Route Handlers.
  - Hecho cuando: un módulo de servidor crea el cliente con cookies SSR y no expone la `service_role`.

- [x] T012 [RF-12] Añadir la actualización segura de sesión Auth en middleware.
  - Hecho cuando: una sesión válida conserva sus cookies al navegar y una ruta protegida puede distinguir una sesión ausente.

- [x] T013 [RF-1–RF-13] Crear la estructura modular `domain`, `application`, `data`, `platform`, `ui` y `shared` con reglas de importación documentadas.
  - Hecho cuando: los módulos tienen puntos de entrada definidos y la UI no importa adaptadores de persistencia directamente.

- [x] T014 [RF-1–RF-13] Definir el tipo común de resultado y el catálogo inicial de códigos de error de aplicación.
  - Hecho cuando: los servicios pueden devolver éxito o un error tipado sin usar `any`, excepciones genéricas ni mensajes SQL.

- [x] T015 [RF-1–RF-13] Crear el mapeo central de errores estables en inglés a mensajes visibles en español.
  - Hecho cuando: cada código inicial tiene un mensaje español orientado a la acción y la UI no necesita traducir errores ad hoc.

- [x] T016 [RF-4, RF-5, RF-8, RF-12] Definir `OrderStatus`, `CancellationReasonCode`, `NotificationStatus`, `NotificationKind` y `RestaurantUserRole`.
  - Hecho cuando: los tipos contienen únicamente los valores cerrados establecidos en `plan.md` y tienen pruebas de exhaustividad.

- [x] T017 [RF-2, RF-3, RF-6, RF-10, RF-12, RF-13] Definir el contrato `PublicTrackingSnapshot` sin identificadores internos.
  - Hecho cuando: el tipo contiene solo restaurante, número, estado, estimación, actualización, instrucciones, cancelación, expiración y última actualización.

- [x] T018 [RF-11, RF-12] Definir el contrato `DashboardSummary` con intervalo, conteos, totales y promedios anulables.
  - Hecho cuando: el tipo incluye `averagePreparationSeconds` y `averagePickupSeconds` como `number | null` y no admite datos mezclados de restaurantes.

- [x] T019 [RF-1, RF-4, RF-5, RF-13] Crear esquemas Zod para creación, transición, cancelación y actualización de estimación.
  - Hecho cuando: las pruebas aceptan entradas válidas y rechazan obligatorios ausentes, estados desconocidos, fechas inválidas y `OTHER` sin texto.

- [x] T020 [RF-11, RF-12] Crear esquemas Zod para selección de restaurante, jornada y programación de hora de corte.
  - Hecho cuando: las pruebas aceptan una hora local válida y rechazan restaurantes, intervalos u horas con formato inválido.

## Fase 2 — Persistencia y aislamiento

- [x] T021 [RF-4, RF-5, RF-8, RF-12] Crear una migración inicial con enums de dominio y el esquema privado para notificaciones.
  - Hecho cuando: la migración crea todos los enums cerrados y `private` sin conceder acceso directo a roles cliente.

- [x] T022 [RF-11, RF-12] Añadir `organizations`, `restaurants` y sus claves, timestamps y configuración de jornada.
  - Hecho cuando: la migración crea ambas tablas, `America/Bogota`, corte `00:00` y las columnas de cambio pendiente descritas en el plan.

- [x] T023 [RF-1, RF-4, RF-5, RF-11, RF-12, RF-13] Añadir `restaurant_users` con membresía activa y rol de operador.
  - Hecho cuando: la tabla tiene PK compuesta, FK a `auth.users`, índice inverso y solo `OPERATOR` es aceptado.

- [x] T024 [RF-1, RF-3, RF-4, RF-5, RF-9, RF-11, RF-12, RF-13] Añadir la tabla `orders` con estado, jornada, estimación, cancelación, hitos, actores y versión.
  - Hecho cuando: la tabla contiene todos los campos definidos en el plan con timestamps UTC, FKs e imposibilidad de `DELETE` para roles de aplicación.

- [x] T025 [RF-1, RF-5, RF-9, RF-13] Añadir constraints de coherencia y unicidad a `orders`.
  - Hecho cuando: PostgreSQL rechaza jornadas inválidas, duplicados normalizados por restaurante/jornada, estimaciones nulas y cancelaciones incoherentes.

- [x] T026 [RF-1, RF-11, RF-12] Añadir los índices operativos de `orders`.
  - Hecho cuando: existen los índices de jornada/estado y de hitos `ready_at` y `delivered_at` definidos en el plan.

- [x] T027 [RF-4, RF-5, RF-9, RF-11] Añadir `order_status_history` como historial append-only.
  - Hecho cuando: la tabla registra origen, destino, motivo, actor y momento, y los roles de aplicación no pueden actualizar ni borrar eventos.

- [x] T028 [RF-2, RF-3, RF-10, RF-12] Añadir `tracking_sessions` con nonce, versión, revocación y expiración.
  - Hecho cuando: nonce y sesión vigente son únicos, el token completo no tiene columna de almacenamiento y todas las FKs están indexadas.

- [x] T029 [RF-2, RF-3, RF-6, RF-10, RF-12] Añadir `tracking_viewers` con identidad anónima, tópico y vigencia.
  - Hecho cuando: la PK e índices impiden grants duplicados y permiten autorizar por `auth.uid()`, tópico y expiración.

- [x] T030 [RF-8, RF-10, RF-12] Añadir `private.push_subscriptions` y `private.tracking_push_subscriptions`.
  - Hecho cuando: endpoint digest es único, el material Web Push queda en `private` y una suscripción puede asociarse idempotentemente con varios trackings.

- [x] T031 [RF-7, RF-8, RF-10] Añadir `private.notifications` con unicidad e índice de despacho.
  - Hecho cuando: la tabla impide duplicar `ORDER_READY` por pedido/suscripción y permite consultar intentos pendientes por `status` y `next_attempt_at`.

- [x] T032 [RF-1, RF-11] Implementar la función SQL que calcula una jornada desde zona IANA y hora de corte.
  - Hecho cuando: pruebas cubren `00:00`, un corte personalizado, cruce de medianoche y conversión a UTC.

- [x] T033 [RF-11, RF-12] Implementar la promoción atómica de una hora de corte pendiente.
  - Hecho cuando: la función conserva la jornada en curso y activa el nuevo corte solo al alcanzar su siguiente vigencia.

- [x] T034 [RF-1] Implementar la normalización SQL del número visible de pedido.
  - Hecho cuando: espacios extremos y diferencias de mayúsculas producen la misma clave normalizada sin alterar el valor visible.

- [x] T035 [RF-12] Crear helpers SQL de autorización para membresía activa y tipo de identidad.
  - Hecho cuando: las funciones distinguen operadores de usuarios anónimos y nunca autorizan mediante metadata editable.

- [x] T036 [RF-11, RF-12] Habilitar RLS y políticas de lectura para organizaciones, restaurantes y membresías.
  - Hecho cuando: un operador solo lee los restaurantes con membresía vigente y un usuario anónimo no obtiene filas.

- [x] T037 [RF-1, RF-4, RF-5, RF-9, RF-11, RF-12, RF-13] Habilitar RLS de operador para `orders` y `order_status_history`.
  - Hecho cuando: lecturas y mutaciones cruzadas son denegadas y las políticas `UPDATE` validan tanto acceso previo como posterior.

- [x] T038 [RF-2, RF-3, RF-6, RF-10, RF-12] Habilitar RLS para sesiones y viewers de tracking.
  - Hecho cuando: un viewer vigente lee solo su tracking, conocer otro nonce no concede acceso y un anónimo no obtiene permisos operativos.

- [x] T039 [RF-8, RF-10, RF-12] Revocar grants cliente sobre tablas del esquema `private` y definir el acceso mínimo del backend de notificaciones.
  - Hecho cuando: `anon` y `authenticated` no pueden leer endpoints, claves ni filas de notificación mediante SQL directo.

- [x] T040 [RF-6, RF-11, RF-12, RF-13] Crear políticas de tópicos privados sobre `realtime.messages`.
  - Hecho cuando: tracking exige viewer vigente, dashboard exige membresía activa y ninguna política modifica objetos internos del esquema Realtime.

- [x] T041 [RF-1, RF-2, RF-9, RF-11, RF-12] Implementar la función transaccional de creación de pedido, historial y tracking.
  - Hecho cuando: una llamada autorizada crea las tres filas o ninguna, calcula la jornada, inicia en `RECEIVED` y devuelve el nonce confirmado.

- [x] T042 [RF-4, RF-9, RF-10, RF-12] Implementar la función transaccional de transición de estado.
  - Hecho cuando: bloquea la fila, valida la matriz, fija el hito, incrementa versión y añade exactamente un evento.

- [x] T043 [RF-4, RF-9] Añadir idempotencia y control de concurrencia a la transición de estado.
  - Hecho cuando: una repetición devuelve el estado vigente sin otro evento y dos acciones concurrentes convergen sin saltos válidos duplicados.

- [x] T044 [RF-5, RF-9, RF-10, RF-12] Implementar la función transaccional de cancelación.
  - Hecho cuando: solo cancela `RECEIVED` o `PREPARING`, valida el motivo, fija `cancelled_at` y registra el evento con motivo.

- [x] T045 [RF-6, RF-12, RF-13] Implementar la función transaccional de actualización de estimación.
  - Hecho cuando: actualiza fecha, marca `estimate_updated_at` y versión solo en `RECEIVED` o `PREPARING` para un operador autorizado.

- [x] T046 [RF-11, RF-12] Implementar la función de programación de hora de corte.
  - Hecho cuando: una membresía vigente programa el siguiente corte y un usuario ajeno no modifica la configuración.

- [x] T047 [RF-1, RF-9] Escribir pruebas pgTAP de creación, unicidad, atomicidad e historial inicial.
  - Hecho cuando: las pruebas demuestran creación completa, rollback sin huérfanos y duplicado solo dentro del mismo restaurante/jornada.

- [x] T048 [RF-4, RF-9] Escribir pruebas pgTAP de la matriz completa de transiciones e idempotencia.
  - Hecho cuando: todos los avances, saltos, retrocesos, estados finales y repeticiones tienen el resultado esperado sin historial extra.

- [x] T049 [RF-5, RF-9, RF-10] Escribir pruebas pgTAP de cancelación y expiración terminal inicial.
  - Hecho cuando: cubren los cuatro motivos, `OTHER`, estados prohibidos, motivo persistido y vigencia final de 24 horas.

- [x] T050 [RF-11, RF-12, RF-13] Escribir pruebas pgTAP de corte, estimación y aislamiento multi-tenant.
  - Hecho cuando: cubren cambio diferido, estados editables/bloqueados y accesos cruzados para dos restaurantes.

## Fase 3 — Operación del restaurante

- [x] T051 [RF-12] Implementar `signInOperator` y `signOutOperator` con Supabase Auth.
  - Hecho cuando: credenciales válidas crean sesión, credenciales inválidas devuelven `INVALID_CREDENTIALS` y cerrar sesión elimina la sesión.

- [x] T052 [RF-12] Crear la pantalla española de inicio de sesión sin registro ni recuperación pública.
  - Hecho cuando: el formulario es accesible, muestra errores tipados y no contiene enlaces de registro, recuperación ni proveedores sociales.

- [x] T053 [RF-12] Proteger el layout del operador mediante claims verificados.
  - Hecho cuando: una sesión ausente o anónima se redirige al acceso y un operador autenticado abre el panel.

- [x] T054 [RF-11, RF-12] Implementar el servicio que lista restaurantes autorizados y conserva el restaurante activo.
  - Hecho cuando: solo aparecen membresías vigentes, la selección se valida en servidor y el restaurante activo queda claramente identificado.

- [x] T055 [RF-11, RF-12] Crear el selector de restaurante activo y sus estados vacío y de carga.
  - Hecho cuando: un operador multi-restaurante puede cambiar de contexto sin mezclar datos y uno sin acceso ve una explicación segura.

- [x] T056 [RF-1, RF-2, RF-9, RF-11, RF-12] Implementar el adaptador y servicio `createOrder` sobre la función transaccional.
  - Hecho cuando: el servicio valida entrada, identidad y restaurante, traduce duplicados y devuelve resumen, nonce y datos para el QR.

- [x] T057 [RF-1, RF-13] Crear el formulario de pedido con número, minutos estimados e instrucciones opcionales.
  - Hecho cuando: obliga número y estimación, no pide PII y presenta errores de campo en español.

- [x] T058 [RF-1, RF-12, RF-13] Conectar el formulario con `createOrder` mediante Server Action.
  - Hecho cuando: una creación confirmada muestra el pedido y un error no se presenta como éxito ni conserva datos sensibles.

- [x] T059 [RF-2, RF-12] Implementar la generación de token HMAC versionado a partir del nonce.
  - Hecho cuando: la firma usa secreto solo de servidor, produce al menos 128 bits de entropía efectiva y tiene vectores de prueba válidos y alterados.

- [x] T060 [RF-2, RF-10, RF-12] Construir la URL de tracking con token en el fragmento y generar el QR.
  - Hecho cuando: el QR decodifica a una URL con `#token`, sin `order_number`, ID interno ni token en path o query.

- [x] T061 [RF-2] Crear la vista de presentación y reimpresión del QR vigente.
  - Hecho cuando: tras crear el pedido el operador ve número y QR, puede volver a presentarlo y no se crea otra sesión.

- [x] T062 [RF-4, RF-6, RF-9, RF-12] Implementar el servicio `transitionOrder` y su Server Action.
  - Hecho cuando: acepta estado esperado/destino, devuelve `idempotent`, traduce conflictos y nunca ejecuta escrituras separadas.

- [x] T063 [RF-4, RF-9] Añadir acciones contextuales de avance al componente de pedido.
  - Hecho cuando: cada estado muestra solo su siguiente acción válida y una respuesta concurrente actualiza la UI al estado vigente.

- [x] T064 [RF-5, RF-9, RF-10, RF-12] Implementar el servicio `cancelOrder` y su Server Action.
  - Hecho cuando: valida código y texto `OTHER`, devuelve el estado final y traduce cancelaciones prohibidas sin modificar la UI prematuramente.

- [x] T065 [RF-5] Crear el diálogo de cancelación con motivos y texto condicional.
  - Hecho cuando: los cuatro motivos cancelan sin texto, `Otro` exige texto breve y el diálogo muestra errores en español.

- [x] T066 [RF-6, RF-12, RF-13] Implementar el servicio `updateOrderEstimate` y su Server Action.
  - Hecho cuando: una nueva fecha futura se guarda en estados permitidos y `ESTIMATE_LOCKED` conserva el valor anterior.

- [x] T067 [RF-13] Crear el formulario de ajuste de estimación para estados editables.
  - Hecho cuando: aparece únicamente en `RECEIVED` o `PREPARING`, confirma el valor actualizado y no comunica la estimación como garantía.

- [x] T068 [RF-1, RF-4, RF-5, RF-13] Escribir pruebas de componentes para formularios y acciones del operador.
  - Hecho cuando: cubren validación, doble envío, errores, acción válida y visibilidad de controles por estado.

- [x] T069 [RF-1, RF-4, RF-5, RF-9, RF-12, RF-13] Escribir pruebas de integración de los contratos operativos contra Supabase local.
  - Hecho cuando: cubren creación, transición, cancelación, estimación, idempotencia y denegación cruzada con persistencia real.

## Fase 4 — Tracking público y Realtime

- [x] T070 [RF-2, RF-10, RF-12] Implementar validación de formato, versión y HMAC del token de tracking.
  - Hecho cuando: acepta un token generado, rechaza tokens truncados, alterados o de versión desconocida y nunca registra el token completo.

- [x] T071 [RF-2, RF-3, RF-12] Crear la ruta pública dinámica de tracking y el lector cliente del fragmento.
  - Hecho cuando: la ruta abre sin cuenta visible, obtiene el token solo en navegador y no lo envía en la solicitud HTTP inicial.

- [x] T072 [RF-2, RF-3, RF-6, RF-12] Crear o reutilizar una sesión anónima de Supabase al abrir tracking.
  - Hecho cuando: el cliente obtiene `auth.uid()` anónimo sin PII, formulario ni instalación y reutiliza la sesión vigente.

- [x] T073 [RF-2, RF-3, RF-10, RF-12] Implementar la operación SQL que concede un viewer tras validar tracking vigente.
  - Hecho cuando: crea un grant ligado a sesión anónima y tracking específico, copiando expiración/revocación sin conceder acceso a otros pedidos.

- [x] T074 [RF-2, RF-3, RF-10, RF-12] Implementar el Route Handler `exchangeTrackingToken` sin caché compartida.
  - Hecho cuando: intercambia una sola vez el token por nonce/grant y un acceso inválido, inexistente, revocado o expirado obtiene una respuesta no enumerable.

- [x] T075 [RF-2, RF-10, RF-12] Eliminar el token del historial del navegador después del intercambio.
  - Hecho cuando: la URL visible y el historial quedan sin token, y recargar usa el nonce con el grant anónimo vigente.

- [x] T076 [RF-3, RF-10, RF-12, RF-13] Implementar la consulta de proyección pública autorizada.
  - Hecho cuando: exige viewer y nonce coincidentes, aplica vigencia y devuelve exactamente `PublicTrackingSnapshot` sin IDs ni actores.

- [x] T077 [RF-3, RF-6, RF-10, RF-12, RF-13] Implementar `getPublicTrackingSnapshot` como Route Handler dinámico.
  - Hecho cuando: responde sin caché compartida, traduce fallos de forma segura y nunca devuelve SQL, claims, tokens o identificadores internos.

- [x] T078 [RF-3, RF-13] Crear la vista mobile-first del seguimiento activo.
  - Hecho cuando: muestra restaurante, número, estado, siguiente paso, estimación aproximada e instrucciones opcionales en orden de prioridad.

- [x] T079 [RF-3] Añadir estados de carga, fallo recuperable y acceso inválido a la vista pública.
  - Hecho cuando: un fallo recuperable ofrece reintento y un acceso inválido no revela restaurante, número, estado ni existencia del pedido.

- [x] T080 [RF-7, RF-13] Implementar la presentación visual prioritaria de `READY`.
  - Hecho cuando: texto y jerarquía cambian inequívocamente a “Listo para retirar”, sin depender solo de color, sonido, vibración o push.

- [x] T081 [RF-5, RF-10] Implementar las vistas terminales `CANCELLED` y `DELIVERED` en solo lectura.
  - Hecho cuando: cancelación muestra su motivo, entrega muestra cierre y ninguna vista terminal ofrece acciones de modificación.

- [x] T082 [RF-4, RF-5, RF-6, RF-9, RF-10, RF-11, RF-13] Publicar Broadcasts mínimos después de commits de pedido.
  - Hecho cuando: los eventos contienen versión, tipo y campos permitidos, y no contienen token, endpoint, actor, organización ni fila completa.

- [x] T083 [RF-6, RF-10, RF-12, RF-13] Implementar el cliente de canal privado para el tópico concedido.
  - Hecho cuando: un viewer vigente se suscribe a su pedido, recibe cambios y no puede abrir el tópico de otro tracking.

- [x] T084 [RF-6] Implementar estados de conexión `connecting`, `connected`, `stale` y `reconnecting`.
  - Hecho cuando: la UI conserva el último snapshot y muestra una advertencia explícita al perder la conexión.

- [x] T085 [RF-6, RF-10, RF-13] Implementar reconexión con backoff y refetch autoritativo.
  - Hecho cuando: al reconectar se recupera el snapshot vigente antes de retirar la advertencia y los eventos omitidos no dejan estado incorrecto.

- [x] T086 [RF-3, RF-6] Añadir la acción permanente de actualización manual del seguimiento.
  - Hecho cuando: el cliente puede solicitar un snapshot nuevo durante una interrupción sin perder el último estado visible.

- [x] T087 [RF-10, RF-12] Implementar `revokeTrackingSession` para operadores autorizados.
  - Hecho cuando: la revocación invalida de inmediato sesión, viewers y asociaciones push sin borrar pedido ni historial.

- [x] T088 [RF-10, RF-12] Aplicar expiración de tracking exactamente 24 horas después de un estado final.
  - Hecho cuando: antes del límite se muestra el resultado final y desde el límite la respuesta oculta toda información del pedido.

- [x] T089 [RF-2, RF-3, RF-10, RF-12] Escribir pruebas de integración de intercambio, snapshot, revocación y expiración.
  - Hecho cuando: cubren token válido, manipulado, inexistente, revocado, expirado y grant que intenta leer otro pedido.

- [x] T090 [RF-6, RF-7, RF-10, RF-13] Escribir pruebas de integración de Broadcast, pérdida de eventos y recuperación.
  - Hecho cuando: estado y estimación se actualizan, una desconexión conserva snapshot y el refetch corrige la versión al reconectar.

- [x] T091 [RF-3, RF-5, RF-6, RF-7, RF-10, RF-13] Escribir pruebas de componentes de todos los estados del tracking.
  - Hecho cuando: cubren activo, estimación actualizada, `READY`, cancelado, entregado, stale, reintento e inválido con verificaciones accesibles.

## Fase 5 — Avisos progresivos

- [x] T092 [RF-8] Implementar detección tipada de capacidades de audio, vibración, Notification API, Service Worker y Push API.
  - Hecho cuando: cada capacidad se informa por separado y una API ausente no produce una excepción ni bloquea tracking.

- [x] T093 [RF-7, RF-8] Crear la acción explícita «Avísame cuando esté listo» y su estado de consentimiento.
  - Hecho cuando: no se solicita ningún permiso antes del clic y después se explican claramente canales disponibles, activados o rechazados.

- [x] T094 [RF-7, RF-8] Implementar el aviso sonoro iniciado a partir de la interacción del cliente.
  - Hecho cuando: al pasar a `READY` intenta reproducir sonido solo tras consentimiento y un fallo conserva intacto el aviso visual.

- [x] T095 [RF-7, RF-8] Implementar el patrón de vibración opcional para `READY`.
  - Hecho cuando: vibra únicamente en dispositivos compatibles tras activación y la ausencia o fallo de la API no afecta el seguimiento.

- [x] T096 [RF-8] Añadir manifest PWA y Service Worker mínimo para recibir `ORDER_READY`.
  - Hecho cuando: la aplicación registra el worker, el manifest es válido y un evento push de prueba muestra título y acción de apertura.

- [x] T097 [RF-8, RF-10, RF-12] Implementar el registro idempotente de una suscripción Web Push.
  - Hecho cuando: valida viewer vigente, calcula digest en servidor y guarda el material solo en `private` sin devolver claves persistidas.

- [x] T098 [RF-8, RF-10] Implementar `enableReadyAlerts` y la asociación tracking–suscripción.
  - Hecho cuando: devuelve canales activados, no duplica asociaciones y rechaza tracking revocado o expirado.

- [x] T099 [RF-7, RF-8] Crear el trigger privado que inserta la outbox al confirmar `READY`.
  - Hecho cuando: cada suscripción activa produce como máximo una notificación `PENDING` después del commit y ningún fallo revierte `READY`.

- [x] T100 [RF-7, RF-8, RF-10, RF-12] Implementar la Edge Function que despacha Web Push con VAPID privada.
  - Hecho cuando: valida nuevamente pedido, tracking y suscripción, envía un payload mínimo y nunca registra endpoint, claves ni token.

- [x] T101 [RF-7, RF-8] Registrar éxito, expiración y fallo de cada intento de notificación.
  - Hecho cuando: actualiza estado, contador, `sent_at` o código redactado y conserva evidencia auditable sin afectar el pedido.

- [x] T102 [RF-7, RF-8] Implementar reintentos al minuto 1 y minuto 5 con máximo tres intentos.
  - Hecho cuando: la programación selecciona pendientes vencidos, respeta los dos retrasos y termina en fallo definitivo después del tercer intento.

- [x] T103 [RF-7, RF-8] Configurar el webhook post-commit y el respaldo programado del procesador.
  - Hecho cuando: una notificación se intenta después del commit y el job programado recupera una fila que no recibió el webhook inicial.

- [x] T104 [RF-7, RF-8] Mostrar feedback no bloqueante para permiso rechazado, canal ausente o aviso fallido.
  - Hecho cuando: cada caso presenta texto español comprensible y el estado, reintento manual y aviso visual siguen utilizables.

- [x] T105 [RF-7, RF-8, RF-10, RF-12] Escribir pruebas de integración de suscripciones, outbox, despacho y reintentos.
  - Hecho cuando: cubren idempotencia, éxito, suscripción inválida, expiración, dos reintentos y fallo definitivo sin revertir `READY`.

- [x] T106 [RF-7, RF-8] Escribir pruebas de componentes para consentimiento y degradación de canales.
  - Hecho cuando: prueban ausencia de solicitud previa, aceptación, rechazo, APIs ausentes y prioridad permanente del aviso visual.

- [x] T107 [RF-7, RF-8] Documentar la matriz manual de avisos y sus resultados esperados por plataforma.
  - Hecho cuando: la matriz enumera aviso visual, audio, vibración, push en primer y segundo plano, permiso rechazado y capacidad ausente para los navegadores objetivo.

- [x] T108 [RF-7, RF-8] Ejecutar la matriz manual de avisos en el navegador Chromium objetivo.
  - Hecho cuando: cada caso aplicable tiene resultado y evidencia registrados, y toda limitación observada conserva el aviso visual.

- [x] T109 [RF-7, RF-8] Ejecutar la matriz manual de avisos en el navegador WebKit objetivo.
  - Hecho cuando: cada caso aplicable tiene resultado y evidencia registrados, y las capacidades no disponibles quedan documentadas sin bloquear el tracking.

## Fase 6 — Dashboard y endurecimiento

- [x] T110 [RF-11, RF-12] Implementar la consulta SQL de pedidos pertenecientes a una jornada operativa.
  - Hecho cuando: filtra por restaurante y `operational_day_started_at`, conserva pedidos que cruzan el corte y no mezcla otros tenants.

- [x] T111 [RF-11] Implementar conteos por estado, total creado y total activo.
  - Hecho cuando: total activo equivale exactamente a `RECEIVED + PREPARING + READY` y los conteos cuadran con la lista de la jornada.

- [x] T112 [RF-9, RF-11] Implementar el promedio de preparación por jornada de finalización.
  - Hecho cuando: promedia `ready_at - preparing_at` solo cuando `ready_at` cae en la jornada y devuelve `null` sin muestras válidas.

- [x] T113 [RF-9, RF-11] Implementar el promedio de recogida por jornada de finalización.
  - Hecho cuando: promedia `delivered_at - ready_at` solo cuando `delivered_at` cae en la jornada y excluye cancelados e intervalos incompletos.

- [x] T114 [RF-11, RF-12] Implementar `getDashboardSummary` sobre las consultas autorizadas.
  - Hecho cuando: valida operador/restaurante/jornada y devuelve un `DashboardSummary` completo o `FORBIDDEN` sin filtrar datos.

- [x] T115 [RF-11, RF-12] Crear la vista de dashboard agrupada por estado.
  - Hecho cuando: muestra restaurante activo, intervalo, grupos, total creado, total activo y pedidos sin mezclar restaurantes.

- [x] T116 [RF-11] Añadir tarjetas de promedios y estados sin datos.
  - Hecho cuando: presenta duraciones comprensibles y muestra «Aún no hay datos» para cada promedio `null` en lugar de cero.

- [x] T117 [RF-1, RF-11] Crear el estado vacío de la jornada con acceso a creación de pedido.
  - Hecho cuando: una jornada sin pedidos muestra una explicación y una acción funcional para abrir el formulario de creación.

- [x] T118 [RF-6, RF-11, RF-12] Suscribir el dashboard al Broadcast privado del restaurante.
  - Hecho cuando: una transición confirmada mueve el pedido y actualiza conteos sin recargar, y un operador ajeno no se suscribe.

- [x] T119 [RF-11, RF-12] Implementar `scheduleOperationalCutoff` en el servicio y Server Action.
  - Hecho cuando: valida hora y membresía, devuelve corte pendiente/vigencia y no modifica la jornada actual.

- [x] T120 [RF-11] Crear el formulario de configuración de hora de corte pendiente.
  - Hecho cuando: muestra corte vigente, próximo corte y fecha efectiva, y explica en español que no reagrupa la jornada en curso.

- [x] T121 [RF-11, RF-12] Escribir pruebas pgTAP de listados, conteos, promedios y jornadas cruzadas.
  - Hecho cuando: cubren corte `00:00`, personalizado, pedido cruzado, cancelados, intervalos incompletos, `null` y aislamiento.

- [x] T122 [RF-11, RF-12] Escribir pruebas de integración y componentes del dashboard y cambio de corte.
  - Hecho cuando: resumen, grupos, estado vacío, actualización Realtime y vigencia diferida se verifican con dos restaurantes.

- [x] T123 [RF-1, RF-2, RF-3, RF-12, RF-13] Crear el primer tramo E2E del flujo principal: autenticación, creación y apertura del QR.
  - Hecho cuando: el operador entra, selecciona restaurante, crea el pedido y un cliente abre su tracking sin registro visible ni PII.

- [x] T124 [RF-4, RF-6, RF-7, RF-8, RF-13] Crear el segundo tramo E2E: preparación, nueva estimación, avisos y estado `READY`.
  - Hecho cuando: el cliente ve automáticamente `PREPARING`, la estimación actualizada y el aviso visual de `READY`, con los canales disponibles activados tras consentimiento.

- [x] T125 [RF-4, RF-9, RF-10] Crear el tramo final E2E: entrega, historial, hitos y expiración.
  - Hecho cuando: `DELIVERED` queda en solo lectura, cada transición tiene un único evento y el tracking deja de revelar datos al simular el límite de 24 horas.

- [x] T126 [RF-5, RF-6, RF-9, RF-10] Crear E2E de cancelación desde `RECEIVED` y `PREPARING`.
  - Hecho cuando: ambos caminos muestran motivo en tracking, bloquean transiciones posteriores y conservan lectura final vigente.

- [x] T127 [RF-6] Crear E2E de pérdida, actualización manual y recuperación de conexión.
  - Hecho cuando: el último estado permanece visible con advertencia, el reintento manual funciona y la reconexión recupera el estado autoritativo.

- [x] T128 [RF-1, RF-4, RF-5, RF-11, RF-12, RF-13] Crear E2E de aislamiento con dos restaurantes y operadores.
  - Hecho cuando: lecturas, mutaciones, dashboards y tópicos cruzados son rechazados sin revelar datos del otro restaurante.

- [x] T129 [RF-2, RF-3, RF-10, RF-12] Crear E2E de token manipulado, revocación y expiración.
  - Hecho cuando: los tres accesos producen respuestas no enumerables y no muestran ningún dato público del pedido.

- [x] T130 [RF-1, RF-4, RF-9, RF-12] Ejecutar pruebas de concurrencia de creación y transición.
  - Hecho cuando: dos creaciones iguales dejan un pedido y dos transiciones simultáneas no duplican hitos ni historial.

- [x] T131 [RF-1–RF-13] Ejecutar la suite completa de calidad del repositorio.
  - Hecho cuando: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` y `pnpm build` terminan sin errores ni supresiones nuevas.

- [x] T132 [RF-1–RF-13] Revisar seguridad, RLS, Realtime y rendimiento con las herramientas de Supabase.
  - Hecho cuando: no quedan hallazgos críticos, todas las tablas expuestas tienen RLS y los predicados e índices usados por políticas están verificados.

- [x] T133 [RF-2, RF-8, RF-10, RF-12] Auditar bundles, respuestas, logs y diff en busca de secretos o datos sensibles.
  - Hecho cuando: `service_role`, HMAC, VAPID privada, tokens completos, endpoints, cookies e IDs internos no aparecen en superficies cliente ni logs.

- [x] T134 [RF-1–RF-13] Completar la matriz final de trazabilidad entre RF, tareas y pruebas ejecutadas.
  - Hecho cuando: RF-1 a RF-13 tienen al menos una tarea de implementación y una verificación exitosa, sin funcionalidades fuera del MVP.
