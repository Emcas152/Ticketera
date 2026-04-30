# SistemaTickets - Frontend Angular

Frontend Angular para el portal administrativo de eventos y tickets.

## Arranque rapido

```bash
cd SistemaTickets
npm install
ng serve
```

Abre `http://localhost:4200/`.

## Alcance actual

- Acceso administrativo con login y recuperacion de contrasena.
- Dashboard interno con resumen operativo, tickets emitidos y perfil.
- Rutas activas orientadas al administrador; el flujo publico de compra no se expone.

## Estructura principal

- `src/app/core`: servicios, guards, interceptors y modelos.
- `src/app/shared`: componentes reutilizables.
- `src/app/modules/auth`: acceso administrativo.
- `src/app/modules/dashboard`: panel interno.
- `src/app/layouts`: layouts publico y dashboard.

## Build

```bash
ng build
```

El resultado se genera en `dist/`.
