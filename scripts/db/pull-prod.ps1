$ErrorActionPreference = "Stop"

function Require-Env([string]$name) {
  $v = [Environment]::GetEnvironmentVariable($name)
  if (-not $v) { $v = $ExecutionContext.SessionState.PSVariable.GetValue($name) }
  if (-not $v) { throw "Missing required env var: $name" }
  return $v
}

$SshHost = Require-Env "KARDUM_EC2_HOST"        # e.g. 1.2.3.4 or ec2-x.compute.amazonaws.com
$SshUser = (Get-Item env:KARDUM_EC2_USER -ErrorAction SilentlyContinue)?.Value
if (-not $SshUser) { $SshUser = "ec2-user" }
$SshKey  = Require-Env "KARDUM_EC2_KEY_PATH"    # e.g. C:\keys\kardum.pem
$RemoteDir = Require-Env "KARDUM_EC2_APP_DIR"   # directory where docker compose + .env live

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$RemoteDump = "/tmp/kardum-prod-$Stamp.dump"
$LocalDir = Join-Path $PSScriptRoot "dumps"
New-Item -ItemType Directory -Force -Path $LocalDir | Out-Null
$LocalDump = Join-Path $LocalDir ("kardum-prod-$Stamp.dump")

Write-Host "Creating DB dump on EC2..."

# Runs pg_dump using a disposable postgres image, reading DATABASE_URL from .env in $RemoteDir.
# Notes:
# - This does NOT expose credentials to your terminal history beyond remote execution.
# - Requires that EC2 can reach the production Postgres (RDS / managed PG).
$RemoteCmd = @"
set -euo pipefail
cd "$RemoteDir"
if [ ! -f .env ]; then
  echo "No .env found at $RemoteDir/.env" >&2
  exit 1
fi
set -a
. ./.env
set +a
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is empty in .env" >&2
  exit 1
fi
docker run --rm postgres:16-alpine sh -lc 'pg_dump "$DATABASE_URL" -Fc -Z 6 -f "$0"' "$RemoteDump"
ls -lh "$RemoteDump"
"@

& ssh -i "$SshKey" "$SshUser@$SshHost" $RemoteCmd

Write-Host "Downloading dump to $LocalDump ..."
& scp -i "$SshKey" "$SshUser@$SshHost`:$RemoteDump" "$LocalDump"

Write-Host "Done."
Write-Host "Next: restore locally with scripts/db/restore-local.ps1 -DumpPath `"$LocalDump`""

