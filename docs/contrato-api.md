# Contrato API verificado

Fuente: `Ticketera-api/routes/api.php` y controladores, revisados el 2026-07-29.
La base de las rutas es `/api`.

## Autenticación

| Método | Ruta | Acceso | Uso administrativo |
|---|---|---|---|
| POST | `/auth/login` | Público | Iniciar sesión; devuelve `token` y `user` |
| GET | `/auth/me` | JWT | Recuperar usuario |
| POST | `/auth/logout` | JWT | Revocar sesión |
| POST | `/auth/forgot-password` | Público | Solicitar recuperación |
| POST | `/auth/reset-password` | Público | Restablecer contraseña |

Roles sembrados por la API:

| ID | Slug | Alcance |
|---:|---|---|
| 1 | `super_admin` | Administración |
| 2 | `admin` | Administración |
| 3 | `authorizer` | Validación de entradas asignadas |
| 4 | `customer` | Compra pública; sin acceso al panel |

## Operación

| Método | Ruta | Protección | Consumidor |
|---|---|---|---|
| GET | `/events`, `/events/{id}` | Público | Público y administración |
| POST/PUT/DELETE | `/events...` | JWT + Admin | Administración |
| GET | `/venues`, `/venues/{venue}` | Público | Público y administración |
| POST/PUT/DELETE | `/venues...` | JWT + Admin | Administración |
| PUT | `/venues/{venue}/seat-map` | JWT + Admin | Diseñador |
| CRUD | `/sections`, `/seats` | JWT + Admin | Recintos/mapas |
| GET | `/bookings` | JWT | Reservas; filtros `status`, `event_id`, `search`, `date_from`, `date_to`, `page`, `per_page` |
| POST | `/bookings` | JWT | Crear reserva |
| POST | `/bookings/{bookingId}/release-seats` | JWT + Admin | Cancela una reserva activa y libera sus asientos; rechaza pagos/tickets |
| GET | `/admin/dashboard-metrics` | JWT + Admin | Métricas agregadas por eventos y período |
| POST | `/guest/bookings`, `/bookings/pay` | Público | Venta pública |
| GET | `/tickets` | JWT | Tickets |
| POST | `/tickets/courtesy` | JWT + Admin | Cortesías |
| POST | `/tickets/authorize-entry` | JWT + Authorizer | Validación QR |
| POST | `/payments/ptranz/merchant-response` | Público, callback | PowerTranz |

## Garantías comprobadas

- Reservas y confirmaciones usan transacciones.
- Los repositorios de booking, asiento y ticket usan `lockForUpdate()`.
- Existe expiración programada de bookings.
- El callback compara el identificador de transacción persistido.
- La validación QR usa transacción y bloqueo.

## Brechas contractuales

- No existe endpoint para editar el perfil del usuario.
- No existe refresh token en las rutas actuales.
- No hay permisos granulares expuestos al frontend; la autorización se basa en rol y
  asignación de personal a eventos.
- Reportes, auditoría y conciliación administrativa no aparecen como endpoints públicos.
