# Deploy Producao Seguro (sem quebrar `.env` e banco)

Este roteiro e o padrao usado no projeto Kardum para subir backend com seguranca.

## 0) Regras de ouro

- Nunca use nome placeholder de arquivo (`AAAAMMDD...`): sempre use o nome real do `.tar.gz`.
- Sempre fazer backup de `kardum-app` e `.env` antes de trocar arquivos.
- Nunca rodar `docker compose down -v` (isso pode destruir volume do banco).
- Sempre restaurar `.env` depois de extrair o pacote.

---

## 1) Build e pacote no Windows (local)

No PowerShell, dentro de `E:\PROJETOS\Kardum Mobile`:

```powershell
cd "E:\PROJETOS\Kardum Mobile"

# 1) Build
npm run build

# 2) Empacotar (sem .git/node_modules/dist e sem incluir o proprio tar)
$TS = Get-Date -Format "yyyyMMdd_HHmmss"
tar -czf "kardum-prod-update-$TS.tar.gz" `
  --exclude=".git" `
  --exclude="node_modules" `
  --exclude="dist" `
  --exclude="kardum-prod-update-*.tar.gz" `
  .

# 3) Upload para servidor
scp -i ".\kardum-sp-key.pem" ".\kardum-prod-update-$TS.tar.gz" ubuntu@56.124.74.238:/home/ubuntu/
```

---

## 2) Deploy no servidor (Ubuntu)

Conectar:

```bash
ssh -i ~/kardum-sp-key.pem ubuntu@56.124.74.238
```

Executar (copiar e colar em bloco):

```bash
set -e
cd /home/ubuntu

TS=$(date +%Y%m%d_%H%M%S)

# 1) Backups (sempre)
cp /home/ubuntu/kardum-app/.env "/home/ubuntu/.env.prod.backup.$TS"
cp -a /home/ubuntu/kardum-app "/home/ubuntu/kardum-app.backup.$TS"
if [ -f /home/ubuntu/kardum-app/deploy/aws/docker-compose.pg.yml ]; then
  cp /home/ubuntu/kardum-app/deploy/aws/docker-compose.pg.yml "/home/ubuntu/docker-compose.pg.yml.backup.$TS"
fi

# 2) Preservar uploads
if [ -d /home/ubuntu/kardum-app/uploads ]; then
  sudo mv /home/ubuntu/kardum-app/uploads /home/ubuntu/uploads.keep
fi

# 3) Recriar app vazio
sudo rm -rf /home/ubuntu/kardum-app
mkdir -p /home/ubuntu/kardum-app

# 4) Descobrir tar mais novo (evita erro de placeholder)
LATEST_TAR=$(ls -t /home/ubuntu/kardum-prod-update-*.tar.gz | head -n 1)
echo "Usando pacote: $LATEST_TAR"
test -f "$LATEST_TAR"
tar -xzf "$LATEST_TAR" -C /home/ubuntu/kardum-app

# 5) Restaurar uploads
if [ -d /home/ubuntu/uploads.keep ]; then
  sudo mv /home/ubuntu/uploads.keep /home/ubuntu/kardum-app/uploads
fi

# 6) Permissao + .env
sudo chown -R ubuntu:ubuntu /home/ubuntu/kardum-app
cp "/home/ubuntu/.env.prod.backup.$TS" /home/ubuntu/kardum-app/.env

# 7) Conferencia rapida de env critico
awk -F= '/^(DATABASE_URL|PGSSLMODE|JWT_SECRET|NODE_ENV|PVP_IDENTITY_DEBUG)=/{print $1"="$2}' /home/ubuntu/kardum-app/.env

# 8) Subir app
cd /home/ubuntu/kardum-app/deploy/aws
FILES="-f docker-compose.yml"
docker compose $FILES up -d --build app1 app2 nginx

# 9) Validacao
docker compose $FILES ps
curl -I http://localhost/health
docker compose $FILES logs --tail=120 app1 app2
```

---

## 3) Rollback (se algo der ruim)

```bash
set -e
cd /home/ubuntu

LAST_BACKUP=$(ls -dt /home/ubuntu/kardum-app.backup.* | head -n 1)
echo "Restaurando backup: $LAST_BACKUP"
test -d "$LAST_BACKUP"

sudo rm -rf /home/ubuntu/kardum-app
cp -a "$LAST_BACKUP" /home/ubuntu/kardum-app
sudo chown -R ubuntu:ubuntu /home/ubuntu/kardum-app

cd /home/ubuntu/kardum-app/deploy/aws
FILES="-f docker-compose.yml"
docker compose $FILES up -d --build app1 app2 nginx
curl -I http://localhost/health
```

---

## 4) Checklist pos deploy

- `curl -I http://localhost/health` retornando `200 OK`
- login funcionando
- matchmaking entra normalmente
- batalha abre para os dois clientes
- portraits corretos nos dois lados
- teste de ataque/vfx em ambos os clientes

