param(
    [Parameter(Mandatory = $true)]
    [string]$Host,

    [Parameter(Mandatory = $true)]
    [string]$User,

    [string]$IdentityFile,
    [string]$RemotePath = "/var/www/sistema-tickets",
    [string]$AppName = "sistema-tickets",
    [int]$NodePort = 4000,
    [string]$Domain = "",
    [string]$NodeMajor = "22",
    [switch]$BootstrapServer,
    [switch]$ConfigureNginx,
    [switch]$SkipLocalBuildCheck
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Require-Command {
    param([Parameter(Mandatory = $true)][string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "No se encontro el comando requerido: $Name"
    }
}

function Invoke-External {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "El comando fallo: $FilePath $($Arguments -join ' ')"
    }
}

Require-Command -Name "ssh"
Require-Command -Name "scp"
Require-Command -Name "tar"
Require-Command -Name "npm"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptRoot
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$archiveName = "$AppName-$timestamp.tar.gz"
$archivePath = Join-Path ([System.IO.Path]::GetTempPath()) $archiveName
$remoteArchivePath = "/tmp/$archiveName"
$remoteScriptPath = "/tmp/deploy-$AppName-$timestamp.sh"
$localRemoteScriptPath = Join-Path ([System.IO.Path]::GetTempPath()) "deploy-$AppName-$timestamp.sh"
$sshTarget = "$User@$Host"

if (-not $SkipLocalBuildCheck) {
    Write-Host "Validando build local..."
    Push-Location $repoRoot
    try {
        Invoke-External -FilePath "npm" -Arguments @("run", "build")
    }
    finally {
        Pop-Location
    }
}

if (Test-Path $archivePath) {
    Remove-Item $archivePath -Force
}

if (Test-Path $localRemoteScriptPath) {
    Remove-Item $localRemoteScriptPath -Force
}

Write-Host "Empaquetando proyecto..."
Push-Location $repoRoot
try {
    Invoke-External -FilePath "tar" -Arguments @(
        "-czf", $archivePath,
        "--exclude=.git",
        "--exclude=.angular",
        "--exclude=.vscode",
        "--exclude=node_modules",
        "--exclude=dist",
        "--exclude=coverage",
        "-C", $repoRoot,
        "."
    )
}
finally {
    Pop-Location
}

$bootstrapValue = if ($BootstrapServer) { "1" } else { "0" }
$configureNginxValue = if ($ConfigureNginx) { "1" } else { "0" }
$domainForConfig = if ([string]::IsNullOrWhiteSpace($Domain)) { "_" } else { $Domain }

$remoteScriptTemplate = @'
#!/usr/bin/env bash
set -euo pipefail

APP_NAME='{{APP_NAME}}'
REMOTE_PATH='{{REMOTE_PATH}}'
ARCHIVE_PATH='{{ARCHIVE_PATH}}'
CURRENT_LINK="$REMOTE_PATH/current"
RELEASES_DIR="$REMOTE_PATH/releases"
TIMESTAMP='{{TIMESTAMP}}'
RELEASE_DIR="$RELEASES_DIR/$TIMESTAMP"
NODE_PORT='{{NODE_PORT}}'
NODE_MAJOR='{{NODE_MAJOR}}'
BOOTSTRAP_SERVER='{{BOOTSTRAP_SERVER}}'
CONFIGURE_NGINX='{{CONFIGURE_NGINX}}'
DOMAIN_NAME='{{DOMAIN_NAME}}'

install_node() {
  if command -v node >/dev/null 2>&1; then
    local current_major
    current_major="$(node -p "process.versions.node.split('.')[0]")"
    if [ "$current_major" = "$NODE_MAJOR" ]; then
      return
    fi
  fi

  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
}

install_pm2() {
  if command -v pm2 >/dev/null 2>&1; then
    return
  fi

  sudo npm install -g pm2
}

if [ "$BOOTSTRAP_SERVER" = "1" ]; then
  sudo apt-get update
  sudo apt-get install -y curl ca-certificates build-essential
  install_node
  install_pm2

  if [ "$CONFIGURE_NGINX" = "1" ]; then
    sudo apt-get install -y nginx
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js no esta instalado en el VPS. Ejecuta el script con -BootstrapServer." >&2
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "PM2 no esta instalado en el VPS. Ejecuta el script con -BootstrapServer." >&2
  exit 1
fi

sudo mkdir -p "$RELEASES_DIR"
sudo chown -R "$USER:$USER" "$REMOTE_PATH"
mkdir -p "$RELEASE_DIR"
tar -xzf "$ARCHIVE_PATH" -C "$RELEASE_DIR"

cd "$RELEASE_DIR"
npm ci
npm run build

cat > "$RELEASE_DIR/ecosystem.config.cjs" <<PM2CONF
module.exports = {
  apps: [
    {
      name: '{{APP_NAME}}',
      cwd: '{{REMOTE_PATH}}/current',
      script: './dist/sistema-tickets/server/server.mjs',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '{{NODE_PORT}}'
      }
    }
  ]
};
PM2CONF

ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
pm2 startOrReload "$RELEASE_DIR/ecosystem.config.cjs" --update-env
pm2 save
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null 2>&1 || true

if [ "$CONFIGURE_NGINX" = "1" ]; then
  if ! command -v nginx >/dev/null 2>&1; then
    echo "Nginx no esta instalado. Ejecuta el script con -BootstrapServer." >&2
    exit 1
  fi

  sudo tee "/etc/nginx/sites-available/$APP_NAME.conf" >/dev/null <<NGINXCONF
server {
    listen 80;
    server_name $DOMAIN_NAME;

    location / {
        proxy_pass http://127.0.0.1:$NODE_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINXCONF

  sudo ln -sfn "/etc/nginx/sites-available/$APP_NAME.conf" "/etc/nginx/sites-enabled/$APP_NAME.conf"
  sudo nginx -t
  sudo systemctl reload nginx
fi

rm -f "$ARCHIVE_PATH"
rm -f "/tmp/deploy-$APP_NAME-$TIMESTAMP.sh"

echo "Despliegue completado en $CURRENT_LINK"
echo "Aplicacion disponible internamente en http://127.0.0.1:$NODE_PORT"
if [ "$CONFIGURE_NGINX" = "1" ]; then
  echo "Nginx configurado para el dominio: $DOMAIN_NAME"
fi
'@

$remoteScript = $remoteScriptTemplate.
    Replace("{{APP_NAME}}", $AppName).
    Replace("{{REMOTE_PATH}}", $RemotePath).
    Replace("{{ARCHIVE_PATH}}", $remoteArchivePath).
    Replace("{{TIMESTAMP}}", $timestamp).
    Replace("{{NODE_PORT}}", $NodePort.ToString()).
    Replace("{{NODE_MAJOR}}", $NodeMajor).
    Replace("{{BOOTSTRAP_SERVER}}", $bootstrapValue).
    Replace("{{CONFIGURE_NGINX}}", $configureNginxValue).
    Replace("{{DOMAIN_NAME}}", $domainForConfig)

[System.IO.File]::WriteAllText($localRemoteScriptPath, $remoteScript, [System.Text.Encoding]::ASCII)

$sshArgs = @()
$scpArgs = @()
if ($IdentityFile) {
    $sshArgs += @("-i", $IdentityFile)
    $scpArgs += @("-i", $IdentityFile)
}

Write-Host "Subiendo paquete al VPS..."
Invoke-External -FilePath "scp" -Arguments ($scpArgs + @($archivePath, "${sshTarget}:$remoteArchivePath"))

Write-Host "Subiendo script remoto..."
Invoke-External -FilePath "scp" -Arguments ($scpArgs + @($localRemoteScriptPath, "${sshTarget}:$remoteScriptPath"))

Write-Host "Ejecutando despliegue remoto..."
Invoke-External -FilePath "ssh" -Arguments ($sshArgs + @($sshTarget, "chmod +x $remoteScriptPath && bash $remoteScriptPath"))

Remove-Item $archivePath -Force -ErrorAction SilentlyContinue
Remove-Item $localRemoteScriptPath -Force -ErrorAction SilentlyContinue

Write-Host "Despliegue finalizado."
