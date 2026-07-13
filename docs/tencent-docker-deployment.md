# Tencent Docker Deployment

TankQuest deploys beside MeteorVoice without sharing containers, ports, databases, or volumes.

## Targets

| Branch | Environment | Host port | Public domain |
| --- | --- | ---: | --- |
| `main` | preview | 3301 | `tq-pre.jcmeteor.com` |
| `release` | release | 3300 | `tankquest.jcmeteor.com` |

Both ports bind only to `127.0.0.1`; host Nginx is the only public entry point. PostgreSQL is internal to each Compose project and stores data in an explicit per-environment directory on the attached data disk.

The host proxy configuration is versioned at `deploy/host-nginx.conf` and uses the existing `*.jcmeteor.com` certificate without changing the MeteorVoice or MeteorTest virtual hosts.

## Services

- `web`: Nginx serves the Vite build and proxies `/api/` to the internal API service.
- `api`: NestJS applies Prisma migrations, runs the idempotent seed, and starts on port 3000.
- `db`: PostgreSQL 17 with a generated per-environment password and persistent project directory.

TankQuest owns only its project subtree on the attached disk:

```text
/data/projects/tankquest/
  preview/
    deploy/
    postgres/
  release/
    deploy/
    postgres/
```

MeteorVoice and MeteorTest keep their current paths until they are migrated into separate sibling project trees. The generated `deployment.env` is stored in the environment's `deploy` directory with mode `0600` and is never committed.

## Verification

```bash
docker compose --project-name tankquest-preview \
  --env-file /data/projects/tankquest/preview/deploy/deployment.env \
  --file /data/projects/tankquest/preview/deploy/docker-compose.yml ps

curl --fail http://127.0.0.1:3301/api/health
curl --fail https://tq-pre.jcmeteor.com/api/health
```

Use port 3300 and the release paths for `release`. If a replacement fails its health check, the deployment script restores the previous API and Web images. PostgreSQL directories are never removed by deployment or rollback.
