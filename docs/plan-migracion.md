# Plan de mejora

## P0 — Seguridad y contrato

- [x] Verificar roles contra la API.
- [x] Separar rutas administrativas de la ruta de validación.
- [x] Revocar el JWT mediante `/auth/logout`.
- [x] Eliminar datos mock como fallback de usuarios reales.
- [x] Retirar la edición ficticia de perfil.
- [x] Agregar pruebas de guards por rol.
- [ ] Agregar pruebas de ciclo completo de sesión.

## P1 — Integridad transaccional

- Probar dos reservas simultáneas sobre el mismo asiento.
- Probar expiración y liberación mediante scheduler.
- Probar callback repetido de PowerTranz.
- Probar dos validaciones simultáneas del mismo QR.
- Sustituir cualquier identificador temporal de cortesía por IDs persistidos.

## P2 — Operación administrativa

- Dividir el dashboard en bundles lazy por módulo.
- Añadir paginación, filtros y ordenamiento servidor donde falten.
- Implementar reportes únicamente después de definir endpoints.
- Incorporar auditoría backend para acciones sensibles.

## Reglas

- La API es la fuente de verdad.
- No añadir mocks a flujos productivos.
- No crear endpoints duplicados.
- No afirmar cobertura completa sin pruebas Angular, Laravel y E2E.
- No modificar la página pública sin una incompatibilidad reproducible.
