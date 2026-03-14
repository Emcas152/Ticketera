# SistemaTickets — Frontend (Angular)

Proyecto frontend Angular (esqueleto) para la plataforma de gestión y venta de eventos.

Arranque rápido:

```bash
cd SistemaTickets
npm install
npx @angular/cli serve --host 0.0.0.0 --port 4200
```

Estructura importante creada bajo `src/app`:
- `core/` servicios, guards, interceptors, models
- `shared/` componentes reutilizables
- `modules/` módulos feature (`auth`, `events`, `booking`, `dashboard`)
- `layouts/` `public-layout` y `dashboard-layout`

Notas:
- Las llamadas a API usan `ApiService` apuntando a `https://api.example.com` (reemplazar).
- Interceptores funcionales `authInterceptor` y `errorInterceptor` fueron añadidos y registrados.
- Autenticación básica por JWT usando `AuthService` y `localStorage`.

Siguientes pasos recomendados:
- Conectar `ApiService` a la API real.
- Reemplazar mocks por llamadas HTTP.
- Integrar Angular Material o Bootstrap según diseño deseado.
# SistemaTickets

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.1.4.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
