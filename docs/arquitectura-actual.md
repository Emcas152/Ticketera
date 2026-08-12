# Arquitectura actual

Fecha de verificación: 2026-07-29.

## Repositorios

| Sistema | Ruta local | Tecnología | Función |
|---|---|---|---|
| Administración | `SistemaTickets` | Angular 21 standalone, Material, RxJS | Panel interno |
| API | `Ticketera-api` | Laravel 11, JWT, MySQL | Fuente de verdad |
| Venta pública | `alconProducciones` | Angular | Compra pública |

## Frontend administrativo

- Bootstrap mediante `ApplicationConfig`; no utiliza `NgModule`.
- Rutas lazy para autenticación y dashboard.
- Sesión JWT enviada mediante interceptor.
- Roles admitidos en el portal: `super_admin`, `admin` y `authorizer`.
- `super_admin` y `admin` acceden a las operaciones administrativas.
- `authorizer` solamente accede al perfil y a la validación QR.
- La API configurada es `http://127.0.0.1:8000/api` en desarrollo y
  `https://api.alconticket.com/api` en producción.

## Módulos existentes

- Autenticación y recuperación de contraseña.
- Resumen administrativo.
- Eventos, recintos y mapas de asientos.
- Ventas en efectivo y cortesías.
- Tickets y validación de acceso.
- Perfil de solo lectura; la API no expone actualización de perfil.

## Riesgos y deuda vigente

- La sesión JWT se persiste en `localStorage`; debe mantenerse una CSP estricta y evitar
  cualquier HTML no confiable. Una migración a cookie `HttpOnly` requiere cambiar la API.
- Existen mocks heredados usados solamente cuando `environment.useMocks` es verdadero. Deben
  aislarse o retirarse cuando dejen de ser necesarios para desarrollo.
- La cobertura automática del frontend es todavía reducida.
- El dashboard se entrega en un único chunk lazy grande; conviene dividir rutas por función.
- Los cambios locales sin confirmar deben preservarse durante la migración.

