# AWS multiplayer rollout (multi-instance)

This setup enables Socket.IO sticky websocket traffic, Redis pub/sub adapter, distributed world state, shard ownership locks, and global matchmaking queues.

## Prerequisites

- Docker + Docker Compose on the VM.
- Environment variables available to each app container:
  - `JWT_SECRET`
  - `DATABASE_URL` (recommended Postgres in production)
  - `REDIS_URL`
  - `INSTANCE_ID` (unique per instance)
- Security group allows HTTP/HTTPS and internal Redis traffic only from app nodes.

## Local validation (single VM)

```bash
cd deploy/aws
docker compose up --build -d
```

This starts:
- `app1` and `app2` (backend instances)
- `redis` (state + adapter + locks + matchmaking queues)
- `nginx` (sticky websocket edge)

## Required flags

Set all flags to enable distributed behavior:

- `MMO_DISTRIBUTED_STATE_ENABLED=true`
- `MMO_SHARD_AUTHORITY_ENABLED=true`
- `MM_MATCHMAKING_REDIS_ENABLED=true`

Keep capacity at:

- `MMO_CHANNEL_MAX_PLAYERS=150`
- `MMO_CHANNEL_SOFT_TARGET=120`

## Production AWS recommendation

- Compute: ECS/Fargate or EC2 Auto Scaling Group.
- Redis: ElastiCache Redis.
- Load Balancer: ALB (enable stickiness for websocket path).
- Database: RDS Postgres (avoid SQLite for multi-instance).

## Canary rollout

1. Deploy 1 instance with flags off.
2. Enable Redis + adapter only.
3. Scale to 2 instances and validate chat/presence/events.
4. Enable distributed state + shard authority.
5. Enable distributed matchmaking.
6. Monitor logs:
   - channel health (`updatesPerSecond`, `avgVisiblePlayers`)
   - lock ownership stability per shard
   - matchmaking success between different instances

