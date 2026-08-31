# Matriz de verificación de avisos de pedido listo

Esta matriz cubre la mejora progresiva de T092–T109. El seguimiento visual y
el estado destacado de `READY` son siempre el canal principal: ningún permiso
ni fallo de una API opcional puede ocultarlos.

| Caso | Chromium escritorio/móvil | WebKit escritorio/móvil | Resultado esperado |
| --- | --- | --- | --- |
| Pedido activo sin interacción | Verificado por E2E | Verificado por E2E | No solicita permisos; se ve seguimiento y el botón opcional. |
| Consentimiento aceptado | Prueba de componente | Prueba de componente | Activa solo canales disponibles y confirma el resultado en texto. |
| Consentimiento denegado | Prueba de componente | Prueba de componente | Explica la denegación y mantiene el seguimiento visual. |
| Audio tras interacción | Prueba de componente | Prueba de componente | Se arma por el gesto y se reproduce únicamente al pasar a `READY`. |
| Vibración disponible/no disponible | Prueba de componente | Prueba de componente | Se usa solo cuando existe; la ausencia no es un error bloqueante. |
| Push, Service Worker y manifest | E2E de manifest | E2E de manifest | El manifest es instalable; el Worker recibe `ORDER_READY` sin token. |
| Reintento y suscripción vencida | Integración y pgTAP | Integración y pgTAP | Persistente, sin duplicados; 1 min, 5 min y máximo tres intentos. |
| `READY` y fallo de canal adicional | Prueba de componente | Prueba de componente | El aviso visual sigue visible y accesible. |

Evidencia automatizada: `pnpm test`, `pnpm test:integration`, `pnpm exec supabase test db` y `pnpm test:e2e`. La matriz E2E usa `chromium-desktop`, `chromium-mobile`, `webkit-desktop` y `webkit-mobile`; las capacidades que dependen de permisos físicos o del sistema operativo se verifican con mocks de navegador y con degradación explícita, sin convertirlas en requisito del flujo principal.
