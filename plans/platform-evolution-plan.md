# Plan de evolucion de la plataforma DM SDR

## Objetivo

Convertir el core actual de prospeccion en una plataforma multiusuario, multi-organizacion y desplegable en produccion. El sistema debe incorporar autenticacion, permisos, persistencia permanente, gestion completa de campanas, ejecuciones ampliables, configuracion segura de proveedores, metricas de uso y costos.

## Decisiones de arquitectura

### Supabase

Usar Supabase para:

- Supabase Auth.
- Login, logout y recuperacion de contrasena.
- Confirmacion de email e invitaciones.
- Postgres como base de datos principal.
- Row Level Security como barrera adicional.

### Railway

Usar Railway para:

- API FastAPI.
- Worker de ejecucion de campanas.
- Variables privadas y secretos globales.
- Logs y despliegue desde GitHub.

El frontend puede desplegarse en Railway para mantener la infraestructura centralizada. Si se prefiere una entrega estatica independiente, Vercel o Netlify son alternativas validas.

### Proveedores

Proveedores iniciales:

- Tavily.
- DeepSeek.
- OpenAI.
- Anthropic Claude.

La aplicacion debe usar una abstraccion comun de proveedores, no llamadas acopladas directamente al pipeline:

```text
ProviderAdapter
  - TavilyAdapter
  - DeepSeekAdapter
  - OpenAIAdapter
  - AnthropicAdapter
```

El pipeline debe registrar siempre el proveedor, modelo y version de credencial utilizados.

## Reglas sobre llaves de servicios

### Variables globales de Railway

Configurar inicialmente como variables privadas:

```text
TAVILY_API_KEY
DEEPSEEK_API_KEY
OPENAI_API_KEY
ANTHROPIC_API_KEY
DEEPSEEK_BASE_URL
OPENAI_BASE_URL
ANTHROPIC_BASE_URL
PROVIDER_CONFIG_ENCRYPTION_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_JWT_SECRET
DATABASE_URL
APP_ENV
```

Las variables globales funcionan como configuracion inicial o fallback. Nunca deben llegar al navegador ni aparecer en logs, respuestas API o mensajes de error.

### Rotacion desde el tablero

No modificar Railway desde el frontend. No guardar un token de Railway con permisos de infraestructura dentro de la aplicacion.

El modelo recomendado es:

```text
1. Credencial de la organizacion, almacenada cifrada en Supabase.
2. Credencial global de Railway como fallback.
3. Proveedor no disponible.
```

La tabla de credenciales debe guardar:

```text
provider_credentials
- id
- organization_id
- provider
- encrypted_api_key
- key_version
- base_url
- default_model
- enabled
- last_validated_at
- last_validation_status
- created_by
- created_at
- updated_at
```

El administrador podra introducir y rotar credenciales desde el tablero, pero el frontend nunca recibira la llave completa.

El flujo de rotacion sera:

1. El admin introduce la nueva llave por HTTPS.
2. El backend valida la conexion con el proveedor.
3. Si falla, la llave actual permanece activa.
4. Si funciona, el backend cifra la nueva llave.
5. Se crea una nueva version.
6. La version anterior queda inactiva, pero auditada.
7. Se registra usuario, fecha, proveedor y resultado.

La llave maestra `PROVIDER_CONFIG_ENCRYPTION_KEY` permanecera solo en Railway. No se guardara en Supabase.

## Fase 0: Preparacion tecnica

### Objetivos

- Congelar el comportamiento estable del core.
- Separar desarrollo, test y produccion.
- Preparar migraciones reproducibles.
- Eliminar dependencias del tenant demo.

### Tareas

- Crear un modulo central de configuracion con Pydantic Settings.
- Reemplazar el SQLite fijo por `DATABASE_URL`.
- Agregar Alembic.
- Agregar el driver de Postgres (`psycopg`).
- Desactivar el seed demo en produccion.
- Mantener el seed solo mediante una bandera explicita de desarrollo.
- Crear `.env.example` sin secretos.
- Mantener `.env`, SQLite, entornos virtuales y artefactos fuera de Git.
- Definir errores HTTP consistentes: `401`, `403`, `404`, `409` y `422`.

### Criterios de aceptacion

- La aplicacion inicia sin SQLite en produccion.
- Las migraciones se pueden ejecutar desde cero.
- No se crean usuarios o campanas demo en Railway.
- Las llaves se leen solo desde configuracion segura.

## Fase 1: Supabase Postgres y modelo multi-tenant

### `organizations`

```text
id
name
plan
status
leads_limit
created_at
updated_at
```

### `profiles`

```text
id
auth_user_id
name
email
avatar_url
status
created_at
updated_at
```

`auth_user_id` debe corresponder al usuario de Supabase Auth.

### `organization_members`

```text
id
organization_id
profile_id
role
status
created_at
updated_at
```

Roles iniciales:

```text
admin
user
```

Usar una tabla de membresias, no un rol global en el perfil, para permitir que un usuario pueda pertenecer a mas de una organizacion en el futuro.

### `campaigns`

Conservar la entidad actual y agregar:

```text
organization_id
created_by
name
prompt
city
status
max_leads
created_at
updated_at
archived_at
```

### `campaign_runs`

Crear una entidad separada para cada ejecucion:

```text
id
campaign_id
organization_id
created_by
run_type
status
city
zones
max_leads
started_at
completed_at
error_message
created_at
```

Valores de `run_type`:

```text
initial
expand
retry
duplicate
```

### `leads`

Conservar los campos actuales y agregar:

```text
organization_id
campaign_id
campaign_run_id
normalized_domain
normalized_company_name
dedupe_key
validation_status
validation_reason
source_url
source_type
source_checked_at
location_verified
business_category_verified
domain_verified
contact_verified
email_verified
confidence_score
created_by_run
created_at
updated_at
```

Crear indices por organizacion, campana, ejecucion, dominio normalizado, `dedupe_key`, estado de validacion y estado comercial.

### `agent_logs`

Agregar:

```text
organization_id
campaign_run_id
duration_ms
provider
model
error_code
```

### `usage_events`

```text
id
organization_id
user_id
campaign_id
campaign_run_id
provider
operation
model
input_tokens
output_tokens
search_requests
leads_found
estimated_cost
metadata
created_at
```

### `provider_health_checks`

```text
id
provider
status
latency_ms
error_message
checked_by
created_at
```

### Criterios de aceptacion

- Cada registro pertenece a una organizacion.
- Cada lead pertenece a una ejecucion.
- No hay consultas que dependan de `default-tenant-id` en produccion.
- Un usuario nunca puede recuperar datos de otra organizacion.
- Toda modificacion de esquema se hace mediante Alembic.

## Fase 2: Autenticacion con Supabase Auth

### Flujos

Implementar:

- Registro.
- Login.
- Logout.
- Confirmacion de email.
- Recuperacion de contrasena.
- Cambio de contrasena.
- Invitacion de usuarios.
- Refresh de sesion.
- Expiracion y renovacion de token.

### Rutas frontend

```text
/login
/register
/forgot-password
/reset-password
```

Crear un `AuthProvider` para gestionar:

- Sesion actual.
- Usuario actual.
- Estado de carga.
- Login.
- Logout.
- Recovery.
- Redireccion de rutas protegidas.

### Backend

Crear una dependencia `get_current_user()` que:

1. Lea el Bearer token.
2. Valide el JWT de Supabase.
3. Resuelva el perfil.
4. Resuelva sus membresias.
5. Rechace tokens expirados o invalidos.

Toda ruta privada debe utilizar esta dependencia.

## Fase 3: Roles y autorizacion

### Usuario

Puede:

- Crear campanas.
- Ejecutar busquedas.
- Ampliar campanas.
- Ver sus campañas y ejecuciones autorizadas.
- Ver y actualizar sus prospectos.
- Consultar logs de sus ejecuciones.
- Ver metricas basicas propias.

No puede:

- Crear usuarios.
- Cambiar roles.
- Configurar proveedores.
- Ver costos globales de la organizacion.

### Admin

Puede:

- Todo lo anterior.
- Invitar usuarios.
- Activar o desactivar usuarios.
- Cambiar roles.
- Ver todas las campanas de la organizacion.
- Ver uso y costos.
- Configurar y rotar proveedores.
- Ver salud de proveedores.
- Configurar limites.

### Reglas

- El backend es la autoridad final.
- El frontend solo controla visibilidad.
- `organization_id` no debe aceptarse ciegamente desde el cliente.
- La organizacion se deriva del token y membresia.
- Todas las consultas se filtran por organizacion.

### Endpoints

```text
GET    /api/me
GET    /api/organizations/current
GET    /api/organizations/current/members
POST   /api/organizations/current/members/invite
PATCH  /api/organizations/current/members/{id}
DELETE /api/organizations/current/members/{id}
```

## Fase 4: Modulo completo de campañas

### Nueva campana

Campos:

```text
name
city
prompt
max_leads
zones opcionales
```

Reglas:

- La ciudad es obligatoria.
- `max_leads` es un limite superior, no una garantia.
- Cambiar de ciudad crea una campana distinta.
- No mezclar mercados diferentes dentro de una misma campana.

### Ampliar campana

“Ampliar campaña” crea una nueva `campaign_run` relacionada con la campaña original.

Casos:

- Buscar mas prospectos en la misma ciudad.
- Buscar zonas que aun no se procesaron.
- Aumentar el maximo.
- Reintentar candidatos pendientes.
- Ejecutar una segunda ronda de Discovery.

La ejecucion original permanece intacta. La ampliacion debe reutilizar la configuracion de la campana, pero guardar sus propias consultas, logs, costos y resultados.

Ejemplo:

```text
Campaña: Restaurantes AAA en Guadalajara

Run 1: Centro y Providencia, maximo 10
Run 2: Zapopan y Andares, maximo 15
Run 3: Revision de pendientes, maximo 10
```

### Duplicar campana

“Duplicar configuración” copia:

- Prompt.
- Tipo de negocio.
- Producto o servicio.
- Tono y configuración de mensajes.

No copia:

- Leads.
- Estados.
- Logs.
- Costos.
- Ejecuciones.

La nueva ciudad debe confirmarse antes de ejecutar.

### Pantalla de campanas

Crear:

```text
/dashboard/campaigns
```

Mostrar:

- Nombre.
- Ciudad.
- Estado.
- Usuario creador.
- Fecha.
- Maximo configurado.
- Candidatos encontrados.
- Leads calificados.
- Pendientes de revision.
- Costo estimado.
- Ultima ejecucion.

Acciones:

- Ver campaña.
- Nueva campaña.
- Ampliar.
- Duplicar.
- Reintentar.
- Archivar.
- Ver leads.
- Ver logs.
- Ver metricas.

### API

```text
GET    /api/campaigns
POST   /api/campaigns
GET    /api/campaigns/{id}
PATCH  /api/campaigns/{id}
POST   /api/campaigns/{id}/runs
GET    /api/campaigns/{id}/runs
GET    /api/campaigns/{id}/runs/{run_id}
POST   /api/campaigns/{id}/duplicate
POST   /api/campaigns/{id}/archive
```

## Fase 5: Discovery por zonas y deduplicacion persistente

### Discovery

Cada ejecucion debe:

1. Usar la ciudad explicita.
2. Usar zonas configuradas.
3. Generar consultas por zona, categoria y tipo de negocio.
4. Guardar las consultas utilizadas.
5. Guardar resultados crudos y sus URLs.
6. Deduplicar antes de Research.
7. Continuar hasta agotar consultas o alcanzar el limite tecnico.

### Dedupe

Normalizar:

- Dominio.
- Nombre comercial.
- Direccion.
- Email institucional.

Crear:

```text
dedupe_key = normalized_domain
```

Si no existe dominio:

```text
dedupe_key = normalized_company_name + normalized_city
```

Reglas:

- No insertar el mismo dominio en una ampliacion.
- No duplicar un negocio entre campanas de la misma organizacion.
- Permitir reintentos solo si existe nueva evidencia.
- Mantener historial de todas las ejecuciones.

## Fase 6: Validacion, contactos y outreach

### Contact Discovery

Solo extraer contactos desde:

- Sitio oficial.
- Pagina oficial de equipo o contacto.
- Fuente profesional integrada y autorizada.
- Directorio autorizado.

Si no existe una fuente verificable:

- `contact_name = null`.
- `contact_role = null`.
- `contact_verified = false`.
- No inventar nombres.
- No fabricar correos.

### Bloqueo de outreach

Solo `QUALIFIED` puede pasar a:

```text
CONTACTED
RESPONDED
MEETING
```

El backend debe rechazar cualquier cambio de estado comercial para `NEEDS_REVIEW` o `UNVERIFIED`.

El frontend debe:

- Deshabilitar el boton de envio.
- Mostrar el motivo de bloqueo.
- Mostrar fuente y validaciones pendientes.

### Reglas minimas de `QUALIFIED`

```text
sitio oficial verificado
AND nombre comercial coincide
AND ciudad/direccion confirmada
AND categoria confirmada
AND fuente no es marketplace, marca matriz, directorio o medio
```

## Fase 7: Configuracion y rotacion de proveedores

### Estado de proveedores

Crear:

```text
GET  /api/admin/providers/status
POST /api/admin/providers/{provider}/validate
```

Responder solo con estado, latencia, fecha y mensaje sanitizado. Nunca devolver secretos.

### Panel admin

Crear:

```text
/dashboard/admin/providers
```

Mostrar por proveedor:

- Configurado.
- Salud.
- Modelo por defecto.
- Base URL.
- Ultima validacion.
- Version activa de credencial.
- Accion de rotar.
- Accion de activar/desactivar.

### Rotacion

1. Admin introduce la nueva llave.
2. Backend valida contra el proveedor.
3. Si falla, conserva la anterior.
4. Si funciona, cifra y versiona la nueva.
5. Desactiva la anterior.
6. Registra auditoria.
7. Las siguientes ejecuciones usan la nueva version.

Guardar en `provider_credentials` solo el valor cifrado. La llave maestra vive en Railway.

## Fase 8: Uso y costos

Cada llamada a Tavily, DeepSeek, OpenAI o Claude debe generar un `usage_event` con:

- Organizacion.
- Usuario.
- Campana.
- Ejecucion.
- Proveedor.
- Modelo.
- Operacion.
- Tokens de entrada.
- Tokens de salida.
- Busquedas.
- Leads encontrados.
- Costo estimado.
- Duracion.
- Error.

Guardar el costo calculado en el momento de la ejecucion para que el historial no cambie al modificar tarifas.

### Panel admin de uso

Crear:

```text
/dashboard/admin/usage
```

Mostrar:

- Coste total.
- Coste por proveedor.
- Coste por usuario.
- Coste por campana.
- Busquedas.
- Leads encontrados.
- Leads calificados.
- Errores.
- Consumo diario y mensual.

## Fase 9: Worker de campanas

El pipeline actual usa `BackgroundTasks`. Para produccion separar:

```text
dm-api
  - Auth
  - CRUD
  - Crear ejecuciones
  - Leer estados
  - Dashboard

dm-worker
  - Tomar ejecuciones queued
  - Ejecutar pipeline
  - Persistir progreso
  - Guardar logs
  - Registrar uso
  - Reintentar errores
```

Estados:

```text
queued
running
completed
completed_with_review
completed_empty
failed
cancelled
```

La primera version puede usar `campaign_runs` como cola con polling. Redis y una cola dedicada pueden agregarse despues.

## Fase 10: Frontend por rol

### Usuario

```text
/dashboard
/dashboard/campaigns
/dashboard/campaigns/new
/dashboard/campaigns/:id
/dashboard/campaigns/:id/leads
/dashboard/campaigns/:id/runs
/dashboard/outreach
```

### Admin

```text
/dashboard/admin/users
/dashboard/admin/providers
/dashboard/admin/usage
/dashboard/admin/settings
```

Todas las rutas deben estar protegidas en frontend y backend.

## Fase 11: Seguridad

- No exponer API keys en navegador.
- No guardar secrets sin cifrar.
- No exponer Supabase service role key.
- Validar JWT en FastAPI.
- Aplicar aislamiento por organizacion en cada query.
- Aplicar roles en backend.
- Sanitizar errores.
- Restringir CORS en produccion.
- Usar HTTPS.
- Rotar secretos.
- No guardar tokens en logs.
- Auditar invitaciones, cambios de roles y rotaciones.
- Configurar RLS en Supabase.

## Fase 12: Tests

### Backend

Cubrir:

- JWT valido e invalido.
- Recuperacion de usuario.
- Aislamiento entre organizaciones.
- Roles admin y user.
- Crear campaña.
- Duplicar campaña.
- Ampliar campaña.
- Deduplicar leads entre ejecuciones.
- Bloqueo de outreach no calificado.
- Rotacion de proveedores.
- Secrets nunca incluidos en respuestas.
- Registro de uso.
- Calculo de costos.
- Reintentos y estados del worker.

### Frontend

Cubrir:

- Login.
- Recovery.
- Proteccion de rutas.
- Menu por rol.
- Nueva campaña.
- Duplicar campaña.
- Ampliar campaña.
- Vista de ejecuciones.
- Bloqueo visual de outreach.
- Panel admin de proveedores.
- Panel admin de uso.

### End-to-end minimo

1. Admin se registra.
2. Admin crea una organizacion.
3. Admin invita un usuario.
4. Usuario acepta la invitacion.
5. Usuario crea una campaña.
6. Worker procesa una ejecucion.
7. Leads quedan persistidos.
8. Usuario amplia la campaña.
9. Dedupe evita duplicados.
10. Admin ve uso y costos.
11. Usuario no puede acceder al panel admin.
12. Usuario no puede acceder a otra organizacion.

## Fase 13: Despliegue

### Supabase

- Crear proyecto.
- Configurar Auth.
- Configurar URLs de redirect.
- Crear Postgres.
- Aplicar migraciones.
- Crear RLS.
- Desactivar seed demo.
- Crear admin inicial.

### Railway

Crear servicios:

```text
dm-api
dm-worker
```

Configurar:

```text
DATABASE_URL
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_JWT_SECRET
TAVILY_API_KEY
DEEPSEEK_API_KEY
OPENAI_API_KEY
ANTHROPIC_API_KEY
DEEPSEEK_BASE_URL
OPENAI_BASE_URL
ANTHROPIC_BASE_URL
PROVIDER_CONFIG_ENCRYPTION_KEY
APP_ENV=production
```

Crear health checks:

```text
GET /health
GET /ready
```

`/health` confirma que el proceso esta vivo. `/ready` confirma que la base y la configuracion minima estan disponibles.

## Orden final de implementacion

1. Configuracion por entorno y Alembic.
2. Supabase Postgres.
3. Organizaciones y membresias.
4. Supabase Auth.
5. JWT en FastAPI.
6. Roles admin y user.
7. Persistencia por organizacion.
8. `campaign_runs`.
9. Modulo completo de campañas.
10. Ampliar, duplicar y archivar campañas.
11. Dedupe persistente.
12. Worker separado.
13. Adaptadores de proveedores.
14. Variables globales de Railway.
15. Rotacion de credenciales por organizacion.
16. Uso y costos.
17. Panel admin.
18. Tests de autorizacion y multi-tenant.
19. Deploy en Railway.
20. Pruebas end-to-end.

## Criterios de aceptacion finales

- Un usuario puede registrarse, iniciar sesion y recuperar su contrasena.
- Un admin puede invitar y administrar usuarios.
- Un usuario no puede acceder a otra organizacion.
- Las campanas persisten despues de reinicios y despliegues.
- Una nueva ciudad crea una campaña independiente.
- Ampliar una campaña crea una ejecucion relacionada.
- No se duplican prospectos entre ejecuciones.
- Las campanas se procesan fuera del proceso web.
- Ninguna API key aparece en el navegador o en texto plano en la base.
- El admin puede ver y rotar proveedores sin tocar Railway desde el frontend.
- El admin puede ver uso y costos.
- Los costos quedan asociados a usuario, campaña, ejecucion y organizacion.
- Solo leads `QUALIFIED` pueden iniciar outreach.
- Las migraciones son reproducibles.
- El sistema se despliega desde GitHub a Railway.
- Los tests cubren aislamiento, roles, auth, campanas y ejecuciones ampliables.
