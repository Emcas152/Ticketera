# Matriz funcional

Estado verificado el 2026-07-29. `Implementado` no implica cobertura completa si la columna
de evidencia indica una prueba pendiente.

| Capacidad | Estado | Evidencia / siguiente control |
|---|---|---|
| Build Angular de producción | Implementado | `npm run build` correcto |
| Pruebas Angular | Parcial | Suite y guards por rol pasan; ampliar sesión y flujos |
| Login JWT | Implementado | `/auth/login`, interceptor Bearer |
| Logout con revocación | Implementado | `/auth/logout` y limpieza local |
| Separación Admin/Authorizer | Implementado | Guards y menú por rol |
| Perfil | Parcial | Lectura real; API no permite edición |
| CRUD de eventos | Parcial | UI/API presentes; falta prueba integral |
| Recintos y mapa | Parcial | UI/API presentes; falta prueba integral |
| Reservas concurrentes | Implementado en API | Transacción y `lockForUpdate`; falta prueba de carrera |
| Estado de reservas | Implementado | Filtros y paginación aplicados por la API |
| Liberación administrativa de asientos | Implementado | Transacción, bloqueo y protección de pagos/tickets |
| Métricas coherentes del dashboard | Implementado | Agregadas por API; no dependen de una página de reservas |
| Expiración de reservas | Implementado en API | Comando programado; falta prueba operativa |
| PowerTranz 3DS | Parcial | Gateway/callback presentes; validar sandbox |
| PDF y QR | Implementado en API | Falta prueba E2E |
| Validación de acceso | Implementado | Exclusivo para authorizer; falta prueba simultánea |
| Cortesías/venta en efectivo | Parcial | UI/API presentes; revisar identificadores temporales |
| Reportes | Pendiente | Sin contrato administrativo |
| Auditoría | Pendiente | Sin contrato administrativo |
| Permisos granulares | Pendiente | API actual trabaja por roles |
| Página pública compatible | Parcial | Consume contrato actual; requiere regresión E2E |
