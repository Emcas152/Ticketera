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

## Venta administrativa y comprobantes

`POST /bookings` debe aceptar `customer_email`, `beneficiary_email`, `payment_method`,
`authorization_number` y `send_ticket_email`. Para ventas no presenciales,
`POST /bookings/pay` recibe `multipart/form-data` con:

- `booking_id`, `ticket_type`, `payment_method` y `nit`;
- `customer_name`, `customer_phone` y `customer_email`;
- `authorization_number` obligatorio para `visalink`, `compraclic` y `transferencia`;
- `payment_proof` obligatorio para esos métodos (JPG, PNG, WEBP o PDF, máximo 5 MB);
- `send_ticket_email=1`.

La API debe guardar el comprobante en almacenamiento privado, persistir solamente su ruta y metadatos,
restringir la descarga a usuarios autorizados y enviar los tickets al correo mediante una cola después
de confirmar la transacción. El envío debe registrarse y ser reintentable; un fallo de correo no debe
revertir una venta confirmada.
- Existe expiración programada de bookings.
- El callback compara el identificador de transacción persistido.
- La validación QR usa transacción y bloqueo.

## Brechas contractuales

- No existe endpoint para editar el perfil del usuario.
- No existe refresh token en las rutas actuales.
- No hay permisos granulares expuestos al frontend; la autorización se basa en rol y
  asignación de personal a eventos.
- Reportes, auditoría y conciliación administrativa no aparecen como endpoints públicos.
