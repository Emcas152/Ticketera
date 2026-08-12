# Prompt maestro — Sistema administrativo de Ticketera

## Instrucción principal

Actúa como arquitecto de software senior y desarrollador full stack especializado en:

- Angular 21, Angular Material, RxJS, TypeScript estricto, PWA y Capacitor.
- Laravel 11, PHP 8.2+, MySQL 8, JWT, colas, jobs, eventos y transacciones.
- Venta de entradas, reservas temporales, mapas de asientos, pagos 3DS y emisión de tickets QR.
- Seguridad OWASP, control de concurrencia, auditoría, pruebas automatizadas y despliegues productivos.

Tu objetivo es transformar el proyecto `Sistema_tickets` en el **sistema administrativo completo de Alcon Ticket**, integrado con la API Laravel `Ticketera-api` y alineado con la experiencia pública de `pagina_tickets`.

No construyas otro sitio de compra para clientes. El resultado debe ser un panel administrativo real para gestionar eventos, recintos, mapas, ventas, reservas, pagos, tickets, clientes, usuarios, reportes y configuración.

## Repositorios y rutas

Repositorio administrativo:

```text
C:\Users\edwin\Desktop\REpos\SistemaTickets
https://github.com/Emcas152/Sistema_tickets
```

API Laravel:

```text
https://github.com/sebcon0313/Ticketera-api.git
```

Página pública de referencia:

```text
https://github.com/Xperts-dev/pagina_tickets
```

Si los repositorios de API y página pública no están clonados, localízalos en las carpetas hermanas de `SistemaTickets`. Si no existen, clónalos únicamente cuando la sesión de GitHub ya tenga permisos. No solicites ni expongas tokens o contraseñas.

## Contexto comprobado del frontend administrativo

Antes de cambiar código, verifica estos datos contra el estado actual:

- El proyecto usa Angular `21.2.x`, Angular Material `21.2.x`, RxJS `7.8.x` y Capacitor `8.x`.
- Conserva una estructura antigua basada en `NgModule` y una plantilla MaterialPro.
- La rama actual contiene flujos orientados al cliente:
  - `/events`
  - `/seat-map/:eventId`
  - `/cart`
  - `/checkout`
  - `/tickets/my-tickets`
  - `/auth/login`
- Los únicos servicios de negocio visibles inicialmente consumen:
  - `POST /login`
  - `GET /events`
  - `GET /events/{id}`
  - `POST /reserve-seat`
  - `POST /orders`
  - `GET /my-tickets`
- Todavía existen módulos, rutas, dependencias, textos y datos de demostración de MaterialPro.
- La instalación limpia puede fallar por dependencias incompatibles, entre ellas:
  - `@swimlane/ngx-charts@16` con RxJS 7.
  - `@swimlane/ngx-datatable@22` con Angular 21.
  - librerías antiguas como `angular-feather`, `chartist`, `ng-chartist`, Protractor y TSLint.
- No hay un control administrativo completo por roles y permisos.
- El `environment.prod.ts` debe validarse; no asumir que `https://alconproducciones.com/api` es la API correcta.

## Reglas de ejecución

1. Inspecciona primero los tres repositorios y el estado de Git. No sobrescribas cambios locales del usuario.
2. No inventes contratos. Extrae rutas, Form Requests, Resources, DTO, enums, estados, relaciones, políticas y respuestas desde `Ticketera-api`.
3. La API es la fuente de verdad. Si el frontend público usa nombres distintos, documenta y corrige la incompatibilidad de forma compatible.
4. No uses mocks en el producto final. Se permiten únicamente en pruebas o Storybook, claramente aislados.
5. No dejes botones decorativos, enlaces vacíos, datos estáticos, `TODO`, `FIXME`, métodos sin implementar ni `console.log`.
6. No almacenes PAN, CVV, datos 3DS sensibles ni secretos de PowerTranz en navegador, base de datos o logs.
7. No resuelvas conflictos de dependencias permanentemente con `--force` o `--legacy-peer-deps`. Sustituye o elimina los paquetes incompatibles.
8. No reescribas toda la aplicación sin necesidad. Conserva lo útil de la plantilla y migra por módulos controlados.
9. Cada operación de escritura debe mostrar estado de carga, éxito, error validado y prevención de doble envío.
10. Todos los listados administrativos deben tener paginación del servidor, búsqueda, filtros, ordenamiento y estados vacíos.
11. Toda acción sensible debe validarse también en Laravel mediante middleware, Policies/Gates y permisos. Ocultar un botón en Angular no es seguridad.
12. Usa nombres de dominio en español coherentes con el negocio, pero conserva los nombres reales de tablas, campos y endpoints existentes cuando cambiarlos rompa compatibilidad.
13. No declares la tarea terminada hasta ejecutar las pruebas y criterios de aceptación indicados al final.

---

# Fase 0 — Auditoría y contrato real

Antes de implementar, crea dentro del repositorio administrativo:

```text
docs/
  arquitectura-actual.md
  contrato-api.md
  matriz-funcional.md
  plan-migracion.md
```

## Auditoría del frontend

Revisa:

- `package.json`, `package-lock.json`, `angular.json`, `tsconfig*.json`.
- rutas principales y lazy loading.
- guards, interceptores, sesión JWT y expiración.
- módulos de plantilla que no pertenecen al producto.
- componentes que sí pueden reutilizarse.
- formularios, modelos, servicios, errores y estilos globales.
- configuración PWA/Capacitor y notificaciones push.
- accesibilidad, responsive, dark mode y build de producción.

Clasifica cada módulo como:

- conservar;
- refactorizar;
- reemplazar;
- retirar de navegación;
- eliminar después de comprobar que no tiene referencias.

## Auditoría de la API

Ejecuta y documenta, como mínimo:

```bash
php artisan about
php artisan route:list --path=api
php artisan migrate:status
php artisan test
```

Inspecciona:

- `routes/api.php` y archivos de rutas relacionados.
- controladores, Form Requests, API Resources, DTO, Services y Actions.
- modelos y relaciones.
- migraciones, índices, restricciones únicas y claves foráneas.
- autenticación JWT y proceso de refresh/logout.
- roles, permisos, Policies y Gates.
- bookings, booking seats, event seats, tickets y payments.
- generación y descarga de tickets PDF/QR.
- gateway PowerTranz SPI, callbacks y estados de pago.
- jobs, scheduler, colas, notificaciones y auditoría.

Genera una tabla de contrato por endpoint con:

| Método | Ruta | Autenticación | Permiso | Request | Response | Errores | Consumidor |
|---|---|---|---|---|---|---|---|

## Comparación con la página pública

Revisa los servicios HTTP y modelos de `pagina_tickets` y crea una matriz:

| Flujo público | Endpoint actual | Modelo esperado | Estado |
|---|---|---|---|
| Listar eventos | | | compatible/incompatible/faltante |
| Detalle del evento | | | |
| Disponibilidad | | | |
| Reserva temporal | | | |
| Crear booking | | | |
| Iniciar PowerTranz | | | |
| Callback/retorno 3DS | | | |
| Confirmar pago | | | |
| Descargar ticket | | | |

No modifiques `pagina_tickets` salvo que exista una incompatibilidad demostrable y el cambio sea retrocompatible o esté incluido en el plan.

## Puerta de control de la fase

No empieces CRUD masivos hasta que `contrato-api.md` identifique:

- endpoints reutilizables;
- endpoints administrativos faltantes;
- estados reales de evento, booking, asiento, pago y ticket;
- roles y permisos reales;
- incompatibilidades entre los tres repositorios.

---

# Fase 1 — Saneamiento técnico de Angular

## Dependencias

1. Elimina módulos demo que no pertenezcan al sistema:
   - mail ficticio;
   - chat ficticio;
   - cursos;
   - notas;
   - tareas demo;
   - widgets y páginas de showcase;
   - tablas/formularios de demostración;
   - dashboards con datos estáticos.
2. Antes de borrar, verifica importaciones y rutas con búsqueda global.
3. Actualiza o reemplaza dependencias incompatibles con Angular 21.
4. Elimina Protractor, TSLint y paquetes obsoletos que no se utilicen.
5. Mantén una sola librería de gráficas compatible con Angular 21.
6. Mantén una sola solución de tabla administrativa compatible con Angular 21, o usa `MatTable` + CDK.
7. Alinea todas las versiones `@angular/*`.
8. Logra que funcionen sin banderas de evasión:

```bash
npm ci
npm run build:prod
npm test -- --watch=false
```

## Núcleo del frontend

Crea o consolida:

```text
src/app/core/
  auth/
  guards/
  interceptors/
  http/
  layout/
  models/
  services/

src/app/shared/
  components/
  directives/
  pipes/
  validators/

src/app/features/
  dashboard/
  events/
  venues/
  seat-maps/
  bookings/
  sales/
  payments/
  tickets/
  scanners/
  customers/
  users/
  reports/
  settings/
  audit/
```

No es obligatorio migrar todo a standalone components de una sola vez. Si la aplicación usa `NgModule`, conserva compatibilidad y migra únicamente cuando aporte valor comprobable.

## Manejo HTTP

Implementa:

- interceptor de `Authorization: Bearer`.
- manejo centralizado de `401`, `403`, `404`, `409`, `422`, `429` y `5xx`.
- logout o refresh controlado cuando expire JWT.
- modelo común para respuestas paginadas.
- traducción de errores de validación Laravel a controles Angular.
- indicador global de carga sin bloquear procesos largos.
- `HttpContext` o mecanismo equivalente para omitir loader en polling.
- cancelación de búsquedas con `switchMap`.
- reintentos únicamente en lecturas idempotentes y errores transitorios.

## Autenticación y permisos

El login debe:

- utilizar el endpoint real de la API;
- guardar solo los datos mínimos de sesión;
- evitar tokens en logs;
- recuperar el usuario autenticado al recargar;
- soportar logout;
- redirigir según permisos;
- bloquear rutas administrativas.

Implementa menú dinámico por permisos. Como mínimo, respeta los roles reales existentes `admin` y `organizador`; no concedas capacidades por defecto. Si la API utiliza permisos más granulares, el frontend debe consumirlos.

---

# Fase 2 — Layout administrativo

Reemplaza la navegación orientada a clientes por un panel profesional:

1. Dashboard
2. Eventos
3. Recintos y mapas
4. Reservas y ventas
5. Pagos
6. Tickets
7. Escáner/validación
8. Clientes
9. Usuarios y permisos
10. Reportes
11. Auditoría
12. Configuración

Requisitos:

- responsive para escritorio, tablet y móvil;
- modo claro y oscuro;
- menú colapsable;
- breadcrumbs reales;
- encabezado con usuario, rol, notificaciones y logout;
- navegación accesible por teclado;
- textos completamente en español;
- identidad visual de Alcon Ticket/Xperts sin imágenes demo de MaterialPro.

No expongas rutas de compra como carrito o checkout dentro del menú administrativo. Si sus componentes se conservan para referencia, deben quedar fuera del bundle o navegación productiva.

---

# Fase 3 — Dashboard administrativo

Crear un dashboard alimentado por API, con rango de fechas y filtros por evento/organizador.

Indicadores:

- ventas brutas;
- ventas aprobadas;
- pagos pendientes, rechazados y reversados;
- reservas activas y expiradas;
- tickets vendidos;
- tickets validados;
- porcentaje de ocupación;
- ingresos por evento;
- comisiones y neto, únicamente si la API dispone de esos datos;
- últimos bookings;
- alertas de callbacks o conciliaciones pendientes.

Gráficas:

- ventas por día;
- ventas por evento;
- ocupación por zona;
- distribución por estado de pago.

Cada tarjeta debe enlazar al listado filtrado correspondiente. No uses números falsos.

---

# Fase 4 — Gestión de eventos

Implementa listado, creación, edición, detalle, publicación, suspensión y finalización según los estados reales de la API.

Campos que deben mapearse a los existentes:

- título;
- slug;
- descripción;
- imágenes;
- fecha y hora;
- recinto;
- dirección/ciudad;
- organizador;
- moneda;
- estado;
- fechas de apertura y cierre de venta;
- políticas y términos;
- configuración de tickets;
- capacidad y disponibilidad.

Características:

- validación reactiva;
- previsualización de imágenes;
- carga segura de archivos;
- prevención de slug duplicado;
- confirmación en acciones destructivas;
- no permitir publicar sin recinto, fecha, mapa/tipos de entrada y capacidad válida;
- mostrar resumen de ventas y ocupación en el detalle.

Las reglas críticas deben existir también en Laravel Form Requests y Services.

---

# Fase 5 — Recintos y diseñador de mapas

Crear CRUD de recintos, secciones, zonas, filas, mesas y asientos.

El diseñador debe representar posiciones reales mediante coordenadas `x` e `y`; no debe convertir cada mesa en una fila lineal.

## Funciones del editor

- lienzo SVG o Canvas con tamaño configurable;
- zoom y desplazamiento;
- cuadrícula y ajuste opcional a la cuadrícula;
- crear, seleccionar, mover, duplicar y eliminar elementos;
- edición múltiple;
- mesas rectangulares o circulares;
- asientos individuales;
- secciones/zonas con color y precio;
- numeración automática de mesas, filas y asientos;
- rotación;
- escenario, entrada, imágenes y etiquetas;
- orden de capas;
- deshacer/rehacer;
- vista previa idéntica o compatible con la página pública;
- validación de coordenadas y duplicados;
- autoajuste del viewport sin alterar las coordenadas persistidas.

## Persistencia

Antes de diseñar el esquema, inspecciona cómo la API guarda actualmente:

- `venueLayout`;
- `seatMap`;
- zonas;
- tablas;
- `position.x` y `position.y`;
- relaciones entre `event_seats`, `seats`, `sections` y eventos.

Si hace falta extender la API:

- crea migraciones reversibles;
- versiona el layout;
- evita JSON opaco cuando una relación normalizada sea necesaria para bloquear o vender asientos;
- permite JSON versionado solo para propiedades puramente visuales;
- agrega validación de esquema;
- garantiza que los identificadores visuales apunten a asientos persistidos.

No generes una fila por mesa. Respeta agrupación, posición, escala y rotación.

---

# Fase 6 — Reservas, ventas y concurrencia

Crear listados administrativos separados o claramente filtrables para:

- reservas activas;
- reservas expiradas;
- bookings pendientes de pago;
- ventas pagadas;
- cancelaciones;
- reembolsos/reversas;
- ventas manuales o de taquilla, solo si el negocio y API las soportan.

## Reglas obligatorias de concurrencia

La API debe impedir que dos compradores obtengan el mismo asiento:

1. Ejecutar la reserva dentro de `DB::transaction`.
2. Consultar y bloquear asientos con `lockForUpdate()`.
3. Validar que todos los asientos pertenecen al evento solicitado.
4. Validar estado vendido, reserva activa y expiración usando hora del servidor.
5. Crear el hold/booking de forma atómica.
6. Usar restricciones e índices de base de datos que refuercen la unicidad.
7. Aplicar TTL configurable a reservas.
8. Liberar reservas expiradas mediante scheduler/job idempotente.
9. Volver a validar y bloquear antes de confirmar el pago.
10. No confiar en el estado mostrado por Angular.

El endpoint debe devolver:

- `409 Conflict` cuando un asiento deja de estar disponible;
- `422` para datos inválidos;
- identificador/token de reserva;
- fecha de expiración absoluta en ISO 8601;
- listado definitivo de asientos reservados.

El frontend debe:

- mostrar contador sincronizado con el servidor;
- persistir solo lo mínimo necesario para recuperar el booking;
- consultar disponibilidad con estrategia eficiente;
- retirar inmediatamente asientos vendidos/reservados;
- manejar `409` sin perder el resto del flujo;
- no crear múltiples intervalos ni suscripciones sin liberar.

---

# Fase 7 — Pagos PowerTranz SPI y conciliación

Respeta el flujo real implementado en `PtranzSpiGateway` y controladores relacionados.

## Requisitos

- El servidor crea `transaction_identifier` y `order_identifier`.
- `order_identifier` debe relacionarse inequívocamente con el booking.
- El callback debe poder recuperar el pago incluso si `payment_id` o `booking_id` no regresan.
- Correlacionar por identificadores seguros y previamente persistidos.
- Guardar el estado inicial antes de redirigir al desafío 3DS.
- El estado `SP4`/“SPI Preprocessing complete” no significa pago aprobado.
- Solo marcar booking pagado cuando la respuesta autorizada y validada lo permita.
- El callback debe ser idempotente.
- Evitar tickets duplicados si PowerTranz reintenta el callback.
- Registrar auditoría sanitizada, nunca PAN/CVV/token sensible completo.
- Verificar monto, moneda, orden y firma/autenticidad disponible.
- Manejar aprobado, rechazado, error, timeout, cancelación y reversa.
- El frontend no decide el resultado del pago; consulta el estado confirmado por backend.

## Panel administrativo de pagos

Debe incluir:

- identificador de transacción;
- orden;
- booking;
- comprador;
- evento;
- importe/moneda;
- código ISO;
- mensaje;
- estado interno y estado del gateway;
- fechas;
- historial de intentos/callbacks sanitizados;
- filtros y exportación;
- acción de conciliación o reconsulta solo si PowerTranz la soporta;
- acciones sensibles limitadas por permiso y con auditoría.

---

# Fase 8 — Tickets y validación QR

## Administración de tickets

- listado por evento, booking, comprador, asiento y estado;
- vista de detalle;
- descarga individual;
- descarga por booking cuando la API lo permita;
- reenvío por correo mediante cola;
- anulación controlada;
- regeneración solo cuando sea segura e idempotente;
- historial de emisión, envío, descarga, validación y anulación.

## Escáner

Implementa una vista móvil compatible con cámara/Capacitor y entrada manual:

- solicitar permisos de cámara correctamente;
- validar QR contra la API;
- mostrar válido, ya utilizado, anulado, no encontrado o evento incorrecto;
- impedir doble uso con operación atómica en backend;
- mostrar hora y usuario/puerta de validación;
- permitir modo de búsqueda manual;
- evitar almacenar información sensible en el QR;
- soportar funcionamiento degradado solo si existe un diseño offline seguro y sincronizable.

La validación del ticket debe usar transacción y bloqueo para impedir dos accesos simultáneos.

---

# Fase 9 — Clientes, usuarios, roles y auditoría

## Clientes

- listado paginado;
- búsqueda por nombre, correo, teléfono o identificador permitido;
- historial de bookings, pagos y tickets;
- datos mínimos necesarios;
- exportación con permisos;
- no permitir edición arbitraria de información de pago.

## Usuarios administrativos

- CRUD según autorización;
- activar/desactivar;
- asignación de roles/permisos existentes;
- organizadores limitados a sus propios eventos y ventas;
- cambio de contraseña seguro;
- cierre/revocación de sesiones si la API lo soporta.

## Auditoría

Registrar en backend:

- actor;
- acción;
- entidad;
- id de entidad;
- valores anteriores y nuevos sanitizados;
- IP y user agent cuando proceda;
- fecha;
- correlación de request.

Auditar publicación de eventos, cambios de mapa/precios, anulaciones, reenvíos, validaciones, reembolsos, cambios de roles y conciliaciones.

---

# Fase 10 — Reportes

Crear reportes con filtros aplicados en servidor:

- ventas por período;
- ventas por evento;
- ocupación;
- pagos por estado;
- tickets emitidos/validados;
- reservas expiradas;
- conciliación;
- comisiones/netos si existen en el dominio.

Permitir exportar CSV/XLSX y PDF desde backend o mediante una solución segura. Las exportaciones deben respetar los mismos permisos y filtros de la pantalla.

No cargues todos los registros en Angular para luego filtrarlos o exportarlos.

---

# Fase 11 — Backend administrativo

Cuando falten endpoints, créalos bajo una convención consistente, preferentemente:

```text
/api/admin/...
```

pero respeta la convención existente si ya hay una establecida.

Para cada recurso:

- rutas protegidas;
- controlador delgado;
- Form Request;
- Policy/Gate;
- Service/Action transaccional;
- API Resource;
- paginación;
- filtros permitidos;
- ordenamiento con lista blanca;
- pruebas Feature;
- documentación en `contrato-api.md`.

Evita consultas N+1 y usa eager loading explícito. Agrega índices basados en filtros reales y comprueba con `EXPLAIN` cuando corresponda.

No devuelvas modelos Eloquent crudos para contratos críticos.

## Respuesta de error consistente

Unifica, sin romper clientes existentes, un formato similar a:

```json
{
  "message": "Descripción legible",
  "code": "SEAT_NOT_AVAILABLE",
  "errors": {
    "seat_ids.0": ["El asiento ya no está disponible."]
  },
  "correlation_id": "..."
}
```

---

# Fase 12 — Seguridad

Aplicar:

- JWT con expiración y revocación según la librería instalada.
- Rate limiting por tipo de endpoint.
- CORS limitado a dominios reales.
- validación estricta de archivos, MIME, tamaño y nombre.
- autorización por recurso/organizador.
- protección contra IDOR.
- mass assignment controlado.
- consultas parametrizadas/Eloquent.
- sanitización de logs.
- CSP y cabeceras de seguridad en despliegue.
- secretos solo en variables de entorno.
- validación de webhook/callback.
- no exponer stack traces en producción.
- bloqueo de cuentas o throttling de login.
- auditoría de operaciones sensibles.

Revisa específicamente OWASP ASVS/API Top 10 para:

- autenticación rota;
- autorización a nivel de objeto;
- autorización a nivel de función;
- consumo de recursos;
- configuración insegura;
- inventario de endpoints;
- datos sensibles.

---

# Fase 13 — Pruebas

## Laravel

Crear pruebas Feature/Unit para:

- login y autorización;
- aislamiento de organizadores;
- CRUD de eventos;
- publicación inválida;
- mapa y asientos;
- dos reservas simultáneas del mismo asiento;
- expiración;
- confirmación de pago;
- callback repetido;
- pago rechazado;
- generación única de tickets;
- doble validación QR;
- filtros y reportes.

Usa base de datos de prueba aislada. No uses credenciales ni gateway productivo.

## Angular

Crear pruebas para:

- guards;
- interceptores;
- sesión;
- permisos de menú;
- formularios;
- mapeo de respuestas;
- errores `401/403/409/422`;
- contador de reserva;
- componentes administrativos críticos;
- diseñador de mapa, al menos en serialización/transformaciones;
- flujos E2E de login, evento, venta, pago simulado y validación.

Elimina o reemplaza pruebas heredadas sin valor que solo comprueban que un componente “se crea”.

---

# Fase 14 — Configuración y despliegue

Configura entornos sin secretos:

```text
Desarrollo:
Frontend administrativo: http://localhost:4200
API: http://localhost:8000/api

Producción esperada, validar antes de fijar:
Página pública: https://alconticket.com
Administrativo: https://sistema.alconticket.com
API: https://api.alconticket.com/api
```

Crear:

- `.env.example` actualizado en Laravel;
- configuración de environment Angular sin secretos;
- instrucciones de instalación;
- comandos de migración, cache, colas y scheduler;
- Nginx para SPA con `try_files`;
- health check;
- estrategia de rollback;
- pipeline CI con instalación limpia, lint, pruebas y build.

Documentar workers:

```bash
php artisan queue:work
php artisan schedule:work
```

En producción utiliza Supervisor/systemd/servicio equivalente y cron para el scheduler según la arquitectura elegida.

---

# Definition of Done

No afirmes “100% funcional” hasta que se cumpla todo lo siguiente:

- `npm ci` funciona sin `--force` ni `--legacy-peer-deps`.
- `npm run build:prod` termina correctamente.
- pruebas Angular pasan.
- `composer install` funciona desde un entorno limpio.
- `php artisan test` pasa.
- migraciones suben y bajan en una base de prueba.
- no hay rutas demo visibles.
- no hay datos falsos en dashboards.
- todos los botones visibles ejecutan una función real autorizada.
- CRUD críticos persisten en API y base de datos.
- errores `401`, `403`, `409`, `422` y `5xx` tienen UX correcta.
- un asiento no puede venderse dos veces bajo concurrencia.
- una reserva expirada se libera.
- un callback repetido no duplica pago ni ticket.
- un ticket no puede validarse dos veces simultáneamente.
- roles y permisos están probados en frontend y backend.
- API y frontend usan el mismo contrato.
- no hay secretos ni datos de tarjeta en repositorio, navegador o logs.
- la página pública continúa funcionando.
- responsive verificado en escritorio, tablet y móvil.
- README contiene instalación, configuración y despliegue.
- `docs/matriz-funcional.md` marca cada requisito como implementado y probado con evidencia.

# Forma de trabajo y entregables

Trabaja en fases pequeñas y verificables. Al finalizar cada fase:

1. enumera archivos creados/modificados;
2. explica decisiones relevantes;
3. muestra comandos ejecutados y resultados;
4. actualiza `docs/matriz-funcional.md`;
5. crea un commit descriptivo solo si el usuario lo autorizó;
6. continúa con la siguiente fase mientras no exista una decisión bloqueante real.

Si falta una decisión de negocio —por ejemplo, quién puede reembolsar, cuánto dura una reserva o qué comisión aplica— no inventes la regla. Implementa la configuración necesaria con un valor documentado solo cuando ya exista un valor vigente en la API o entorno; de lo contrario, pregunta de forma concreta.

Empieza ahora por la **Fase 0**, inspeccionando los tres repositorios y presentando el diagnóstico real antes de modificar código funcional.
