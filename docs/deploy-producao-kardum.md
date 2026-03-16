# Deploy de Producao - Kardum Mobile (Backend)

Este arquivo e o runbook oficial para deploy em producao do backend.
Objetivo: nunca perder o passo a passo, IP e key de acesso.

## Identificadores fixos

- Servidor: `ubuntu@56.124.74.238`
- Key SSH local (Windows): `E:\PROJETOS\Kardum Mobile\kardum-sp-key.pem`
- Arquivo enviado para servidor: `/home/ubuntu/kardum-prod-update.tar.gz`
- Pasta da app no servidor: `/home/ubuntu/kardum-app`
- Pasta docker compose: `/home/ubuntu/kardum-app/deploy/aws`

## 1) Empacotar e enviar (Windows PowerShell)

Executar em `E:\PROJETOS\Kardum Mobile`:

```powershell
$TS = Get-Date -Format "yyyyMMdd_HHmmss"
$ARCHIVE = "E:\PROJETOS\kardum-prod-update-$TS.tar.gz"

Set-Location "E:\PROJETOS\Kardum Mobile"
tar -czf "$ARCHIVE" `
  --exclude=node_modules `
  --exclude=.git `
  --exclude=dist `
  --exclude="*.pem" `
  --exclude="*.tar.gz" `
  .

scp -i "E:\PROJETOS\Kardum Mobile\kardum-sp-key.pem" "$ARCHIVE" ubuntu@56.124.74.238:/home/ubuntu/kardum-prod-update.tar.gz
```

## 2) Conectar no servidor

```powershell
ssh -i "E:\PROJETOS\Kardum Mobile\kardum-sp-key.pem" ubuntu@56.124.74.238
```

## 3) Backup + troca de codigo (sem perder uploads/.env)

```bash
set -e
cd /home/ubuntu
TS=$(date +%Y%m%d_%H%M%S)

# backups
[ -f /home/ubuntu/kardum-app/.env ] && cp /home/ubuntu/kardum-app/.env "/home/ubuntu/.env.prod.backup.$TS"
[ -d /home/ubuntu/kardum-app ] && cp -a /home/ubuntu/kardum-app "/home/ubuntu/kardum-app.backup.$TS"

# preserva uploads
if [ -d /home/ubuntu/kardum-app/uploads ]; then
  sudo mv /home/ubuntu/kardum-app/uploads /home/ubuntu/uploads.keep
fi

# troca codigo
sudo rm -rf /home/ubuntu/kardum-app
mkdir -p /home/ubuntu/kardum-app
tar -xzf /home/ubuntu/kardum-prod-update.tar.gz -C /home/ubuntu/kardum-app

# restaura uploads
if [ -d /home/ubuntu/uploads.keep ]; then
  sudo mv /home/ubuntu/uploads.keep /home/ubuntu/kardum-app/uploads
fi

# restaura .env se vier faltando
if [ ! -f /home/ubuntu/kardum-app/.env ]; then
  cp "$(ls -t /home/ubuntu/.env.prod.backup.* | head -n 1)" /home/ubuntu/kardum-app/.env
fi

# postgres local sem SSL
if grep -q '^DATABASE_URL=' /home/ubuntu/kardum-app/.env; then
  sed -i 's|^DATABASE_URL=.*|DATABASE_URL=postgres://kardum:kardum_pass_2026@postgres:5432/kardum?sslmode=disable|' /home/ubuntu/kardum-app/.env
fi
grep -q '^PGSSLMODE=' /home/ubuntu/kardum-app/.env || echo 'PGSSLMODE=disable' >> /home/ubuntu/kardum-app/.env

sudo chown -R ubuntu:ubuntu /home/ubuntu/kardum-app
```

## 4) Subir containers

```bash
cd /home/ubuntu/kardum-app/deploy/aws

if [ -f docker-compose.pg.yml ]; then
  FILES="-f docker-compose.yml -f docker-compose.pg.yml"
else
  FILES="-f docker-compose.yml"
fi

docker compose $FILES up -d --build
docker compose $FILES ps
```

## 5) Validacao obrigatoria

```bash
curl -I http://localhost/health
docker compose $FILES logs app1 --tail=120
docker compose $FILES logs app2 --tail=120
```

Esperado:
- `curl` retornar `HTTP/1.1 200 OK`.
- `app1` e `app2` sem erro de banco SSL.

## Rollback rapido

Se der problema:

```bash
set -e
cd /home/ubuntu
LAST_BACKUP=$(ls -dt /home/ubuntu/kardum-app.backup.* | head -n 1)
sudo rm -rf /home/ubuntu/kardum-app
cp -a "$LAST_BACKUP" /home/ubuntu/kardum-app
sudo chown -R ubuntu:ubuntu /home/ubuntu/kardum-app
cd /home/ubuntu/kardum-app/deploy/aws
if [ -f docker-compose.pg.yml ]; then
  FILES="-f docker-compose.yml -f docker-compose.pg.yml"
else
  FILES="-f docker-compose.yml"
fi
docker compose $FILES up -d --build
curl -I http://localhost/health
```

## Notas importantes

- Nunca sobrescrever `.env` de producao com `.env` de desenvolvimento.
- Nunca apagar `uploads` sem mover/restaurar antes.
- Nao versionar `.pem`, `.tar.gz` e outros artefatos locais.
