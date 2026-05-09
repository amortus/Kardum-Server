$ErrorActionPreference = "Stop"

param(
  [Parameter(Mandatory = $true)]
  [string]$DumpPath,

  [string]$ComposeFile = "docker-compose.dev.yml",
  [string]$DbService = "db",
  [string]$DbName = "kardum",
  [string]$DbUser = "kardum"
)

if (-not (Test-Path $DumpPath)) {
  throw "Dump file not found: $DumpPath"
}

$DumpPath = (Resolve-Path $DumpPath).Path

# Guardrails: only restore into local docker compose db service.
if ($ComposeFile -notmatch "docker-compose\.dev\.yml$") {
  throw "Refusing to run: ComposeFile must be docker-compose.dev.yml (got: $ComposeFile)"
}

Write-Host "Ensuring local stack is up (db/redis/app)..."
& docker compose -f $ComposeFile up -d db redis | Out-Null

Write-Host "Waiting for Postgres healthcheck..."
$max = 60
for ($i = 0; $i -lt $max; $i++) {
  try {
    & docker compose -f $ComposeFile exec -T $DbService pg_isready -U $DbUser -d $DbName | Out-Null
    break
  } catch {
    Start-Sleep -Seconds 1
  }
  if ($i -eq ($max - 1)) { throw "Postgres not ready after ${max}s" }
}

Write-Host "Dropping and recreating database $DbName ..."
# Terminate any connections and recreate.
& docker compose -f $ComposeFile exec -T $DbService sh -lc "psql -U $DbUser -d postgres -v ON_ERROR_STOP=1 -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DbName';\" -c \"DROP DATABASE IF EXISTS \\\"$DbName\\\";\" -c \"CREATE DATABASE \\\"$DbName\\\";\"" | Out-Null

Write-Host "Restoring dump into $DbName ..."
$dbContainerId = (& docker compose -f $ComposeFile ps -q $DbService).Trim()
if (-not $dbContainerId) { throw "Unable to resolve container id for service: $DbService" }

$remoteDumpPath = "/tmp/restore.dump"
Write-Host "Copying dump into container ($dbContainerId) ..."
& docker cp "$DumpPath" "${dbContainerId}:$remoteDumpPath" | Out-Null

& docker compose -f $ComposeFile exec -T $DbService sh -lc "pg_restore -U $DbUser -d \"$DbName\" --no-owner --role=$DbUser --clean --if-exists --verbose \"$remoteDumpPath\"" | Out-Null
& docker compose -f $ComposeFile exec -T $DbService sh -lc "rm -f \"$remoteDumpPath\"" | Out-Null

Write-Host "Restore complete."
Write-Host "You can now start the app with: docker compose -f $ComposeFile up --build app"

