#!/usr/bin/env bash
set -euo pipefail

required=(APP_NAME ENVIRONMENT API_IMAGE AI_IMAGE WEB_IMAGE HOST_PORT)
for name in "${required[@]}"; do
  if [ -z "${!name:-}" ]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
data_root="${DATA_ROOT:-/data/projects}"
project_dir="${data_root}/${APP_NAME}/${ENVIRONMENT}"
deploy_dir="${project_dir}/deploy"
postgres_data_path="${project_dir}/postgres"
compose_file="${deploy_dir}/docker-compose.yml"
deployment_env="${deploy_dir}/deployment.env"
project_name="${APP_NAME}-${ENVIRONMENT}"

mkdir -p "${deploy_dir}" "${postgres_data_path}"

previous_env_snapshot="$(mktemp)"
previous_compose_snapshot="$(mktemp)"
trap 'rm -f "${previous_env_snapshot}" "${previous_compose_snapshot}"' EXIT
has_previous_deployment=false
if [ -f "${deployment_env}" ] && [ -f "${compose_file}" ]; then
  cp "${deployment_env}" "${previous_env_snapshot}"
  cp "${compose_file}" "${previous_compose_snapshot}"
  has_previous_deployment=true
fi

install -m 0644 "${script_dir}/docker-compose.yml" "${compose_file}"

postgres_password=""
if [ -f "${deployment_env}" ]; then
  postgres_password="$(sed -n 's/^POSTGRES_PASSWORD=//p' "${deployment_env}")"
fi
if [ -z "${postgres_password}" ]; then
  postgres_password="$(openssl rand -hex 24)"
fi
database_url="postgresql://tankquest:${postgres_password}@db:5432/tankquest"
ai_provider="$(sed -n 's/^AI_PROVIDER=//p' "${deployment_env}" 2>/dev/null || true)"
ai_model="$(sed -n 's/^AI_MODEL=//p' "${deployment_env}" 2>/dev/null || true)"
openai_api_key="$(sed -n 's/^OPENAI_API_KEY=//p' "${deployment_env}" 2>/dev/null || true)"
ai_service_timeout_ms="$(sed -n 's/^AI_SERVICE_TIMEOUT_MS=//p' "${deployment_env}" 2>/dev/null || true)"
ai_provider="${ai_provider:-template}"
ai_service_timeout_ms="${ai_service_timeout_ms:-1500}"

write_deployment_env() {
  local api_image="$1"
  local ai_image="$2"
  local web_image="$3"
  {
    printf 'API_IMAGE=%s\n' "${api_image}"
    printf 'AI_IMAGE=%s\n' "${ai_image}"
    printf 'WEB_IMAGE=%s\n' "${web_image}"
    printf 'HOST_PORT=%s\n' "${HOST_PORT}"
    printf 'POSTGRES_PASSWORD=%s\n' "${postgres_password}"
    printf 'DATABASE_URL=%s\n' "${database_url}"
    printf 'POSTGRES_DATA_PATH=%s\n' "${postgres_data_path}"
    printf 'AI_PROVIDER=%s\n' "${ai_provider}"
    printf 'AI_MODEL=%s\n' "${ai_model}"
    printf 'OPENAI_API_KEY=%s\n' "${openai_api_key}"
    printf 'AI_SERVICE_TIMEOUT_MS=%s\n' "${ai_service_timeout_ms}"
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

for image in "${API_IMAGE}" "${AI_IMAGE}" "${WEB_IMAGE}"; do
  if ! docker image inspect "${image}" >/dev/null 2>&1; then
    echo "Image is not loaded: ${image}" >&2
    exit 1
  fi
done

write_deployment_env "${API_IMAGE}" "${AI_IMAGE}" "${WEB_IMAGE}"
if ! compose up -d --wait --wait-timeout 240 \
  || ! curl -fsS --max-time 10 "http://127.0.0.1:${HOST_PORT}/api/health" >/dev/null \
  || ! node "${script_dir}/../scripts/verify-public-deployment.mjs" \
    "http://127.0.0.1:${HOST_PORT}"; then
  if [ "${has_previous_deployment}" = true ]; then
    echo "Deployment failed; restoring previous images" >&2
    install -m 0600 "${previous_env_snapshot}" "${deployment_env}"
    install -m 0644 "${previous_compose_snapshot}" "${compose_file}"
    compose up -d --wait --wait-timeout 240 --remove-orphans
  else
    compose down --remove-orphans || true
  fi
  exit 1
fi

printf 'Deployed %s, %s and %s to %s on 127.0.0.1:%s\n' \
  "${API_IMAGE}" "${AI_IMAGE}" "${WEB_IMAGE}" "${project_name}" "${HOST_PORT}"
