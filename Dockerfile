FROM node:24-bookworm-slim AS dependencies

WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmjs.org

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci --registry="${NPM_REGISTRY}"

FROM dependencies AS builder

COPY . .
RUN npm run build

FROM builder AS production-dependencies

RUN npm prune --omit=dev

FROM nginx:1.28-alpine AS web-runtime

COPY deploy/web-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --retries=12 --start-period=10s \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/api/health || exit 1

FROM node:24-bookworm-slim AS api-runtime

ENV HOST=0.0.0.0 \
    NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=12 --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && node apps/api/dist/main.js"]

FROM python:3.13-slim AS ai-runtime

ARG PYPI_INDEX_URL=https://pypi.org/simple

ENV AI_PROVIDER=template \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY services/ai/pyproject.toml services/ai/README.md ./
COPY services/ai/tankquest_ai ./tankquest_ai

RUN set -eu; \
    for attempt in 1 2 3; do \
      if pip install --no-cache-dir --index-url "${PYPI_INDEX_URL}" --retries 10 --timeout 60 .; then \
        break; \
      fi; \
      if [ "${attempt}" -eq 3 ]; then exit 1; fi; \
      sleep "$((attempt * 5))"; \
    done; \
    useradd --create-home --uid 10001 tankquest

USER tankquest
EXPOSE 8100

HEALTHCHECK --interval=10s --timeout=5s --retries=12 --start-period=20s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8100/health', timeout=3)" || exit 1

CMD ["uvicorn", "tankquest_ai.main:app", "--host", "0.0.0.0", "--port", "8100"]
