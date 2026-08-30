# Arquitectura modular

ToqueTin es un monolito modular. La dependencia permitida es
`ui/application → domain → data/platform adapters`.

- `domain`: contratos y reglas independientes de infraestructura.
- `application`: casos de uso y lectura de identidad verificada.
- `data`: adaptadores de persistencia de negocio.
- `platform`: integración con Next.js, Supabase y entorno.
- `ui`: rutas y presentación; no importa adaptadores de `data` ni `platform`.
- `shared`: resultados tipados y utilidades transversales sin presentación.

Las rutas y componentes visuales consumen contratos de aplicación. Las reglas de
negocio, autorización y consultas de persistencia no viven en componentes UI.
