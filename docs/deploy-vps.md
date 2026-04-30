# Despliegue a VPS

Script principal: `scripts/deploy-vps.ps1`

Supuestos:
- Lo ejecutas desde Windows PowerShell.
- El VPS usa Ubuntu o Debian.
- El acceso al VPS es por `ssh` y `scp`.
- La aplicacion se publica como Angular SSR con Node.js y PM2.

Ejemplo minimo:

```powershell
.\scripts\deploy-vps.ps1 -Host 203.0.113.10 -User root -BootstrapServer
```

Ejemplo con llave SSH, ruta remota y Nginx:

```powershell
.\scripts\deploy-vps.ps1 `
  -Host 203.0.113.10 `
  -User deploy `
  -IdentityFile C:\Users\edwin\.ssh\vps_ed25519 `
  -RemotePath /var/www/sistema-tickets `
  -NodePort 4000 `
  -Domain tickets.midominio.com `
  -BootstrapServer `
  -ConfigureNginx
```

Que hace el script:
- valida el `npm run build` local salvo que uses `-SkipLocalBuildCheck`
- empaqueta el proyecto sin `.git`, `node_modules` ni `dist`
- sube el paquete al VPS
- instala Node.js, PM2 y Nginx si activas `-BootstrapServer`
- ejecuta `npm ci` y `npm run build` en el VPS
- publica la release en `/var/www/sistema-tickets/current`
- levanta la app con PM2 en el puerto indicado
- configura Nginx si activas `-ConfigureNginx`

Parametros utiles:
- `-Host`: IP o dominio del VPS
- `-User`: usuario SSH
- `-IdentityFile`: llave privada SSH opcional
- `-RemotePath`: directorio base del despliegue
- `-AppName`: nombre del proceso PM2
- `-NodePort`: puerto interno de Node.js
- `-Domain`: dominio para `server_name` en Nginx
- `-NodeMajor`: version mayor de Node.js a instalar, por defecto `22`

Antes de desplegar:
- revisa [src/environments/environment.ts](C:/Users/edwin/Desktop/REpos/SistemaTickets/src/environments/environment.ts) y cambia `apiBaseUrl` si todavia apunta a `https://api.example.com/v1`
- confirma que el DNS del dominio apunte al VPS si vas a usar Nginx

Despues del despliegue:
- verifica el proceso con `pm2 status`
- consulta logs con `pm2 logs sistema-tickets`
- si luego agregas HTTPS, puedes usar Certbot sobre la configuracion de Nginx creada
