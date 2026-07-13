#!/usr/bin/env bash
set -euo pipefail

required=(APP_NAME ENVIRONMENT API_IMAGE WEB_IMAGE HOST_PORT)
for name in "${required[@]}"; do
  if [ -z "${!name:-}" ]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
deploy_dir="/srv/containers/${APP_NAME}/${ENVIRONMENT}"
compose_file="${deploy_dir}/docker-compose.yml"
deployment_env="${deploy_dir}/deployment.env"
project_name="${APP_NAME}-${ENVIRONMENT}"

mkdir -p "${deploy_dir}"
install -m 0644 "${script_dir}/docker-compose.yml" "${compose_file}"

postgres_password=""
if [ -f "${deployment_env}" ]; then
  postgres_password="$(sed -n 's/^POSTGRES_PASSWORD=//p' "${deployment_env}")"
fi
if [ -z "${postgres_password}" ]; then
  postgres_password="$(openssl rand -hex 24)"
fi
database_url="postgresql://tankquest:${postgres_password}@db:5432/tankquest"

write_deployment_env() {
  local api_image="$1"
  local web_image="$2"
  {
    printf 'API_IMAGE=%s\n' "${api_image}"
    printf 'WEB_IMAGE=%s\n' "${web_image}"
    printf 'HOST_PORT=%s\n' "${HOST_PORT}"
    printf 'POSTGRES_PASSWORD=%s\n' "${postgres_password}"
    printf 'DATABASE_URL=%s\n' "${database_url}"
  } > "${deployment_env}"
  chmod 0600 "${deployment_env}"
}

compose() {
  docker compose \
    --project-name "${project_name}" \
    --env-file "${deployment_env}" \
    --file "${compose_file}" \
    "$@"
}

previous_api="$(sed -n 's/^API_IMAGE=//p' "${deployment_env}" 2>/dev/null || true)"
previous_web="$(sed -n 's/^WEB_IMAGE=//p' "${deployment_env}" 2>/dev/null || true)"

for image in "${API_IMAGE}" "${WEB_IMAGE}"; do
  if ! docker image inspect "${image}" >/dev/null 2>&1; then
    echo "Image is not loaded: ${image}" >&2
    exit 1
  fi
done

write_deployment_env "${API_IMAGE}" "${WEB_IMAGE}"
if ! compose up -d --wait --wait-timeout 240 \
  || ! curl -fsS --max-time 10 "http://127.0.0.1:${HOST_PORT}/api/health" >/dev/null; then
  if [ -n "${previous_api}" ] && [ -n "${previous_web}" ]; then
    echo "Deployment failed; restoring previous images" >&2
    write_deployment_env "${previous_api}" "${previous_web}"
    compose up -d --wait --wait-timeout 240
  else
    compose down --remove-orphans || true
  fi
  exit 1
fi

docker image prune --force >/dev/null
printf 'Deployed %s to %s on 127.0.0.1:%s\n' "${WEB_IMAGE}" "${project_name}" "${HOST_PORT}"
