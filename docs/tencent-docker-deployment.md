# Tencent Docker Deployment

TankQuest deploys beside MeteorVoice without sharing containers, ports, databases, or volumes.

## Targets

| Branch | Environment | Host port | Public domain |
| --- | --- | ---: | --- |
| `main` | preview | 3301 | `tq-pre.jcmeteor.com` |
| `release` | production | 3300 | `tankquest.jcmeteor.com` |

Both ports bind only to `127.0.0.1`; host Nginx is the only public entry point. PostgreSQL is internal to each Compose project and stores data in its own named volume.

## Services

- `web`: Nginx serves the Vite build and proxies `/api/` to the internal API service.
- `api`: NestJS applies Prisma migrations, runs the idempotent seed, and starts on port 3000.
- `db`: PostgreSQL 17 with a generated per-environment password and persistent volume.

Deployment state is stored under `/srv/containers/tankquest/<environment>`. The generated `deployment.env` is mode `0600` and is never committed.

## Verification

```bash
docker compose --project-name tankquest-preview \
  --env-file /srv/containers/tankquest/preview/deployment.env \
  --file /srv/containers/tankquest/preview/docker-compose.yml ps

curl --fail http://127.0.0.1:3301/api/health
curl --fail https://tq-pre.jcmeteor.com/api/health
```

Use port 3300 and the production paths for `release`. If a replacement fails its health check, the deployment script restores the previous API and Web images. Database volumes are never removed by deployment or rollback.
