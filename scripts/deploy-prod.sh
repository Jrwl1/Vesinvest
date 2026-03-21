#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

REMOTE_HOST="${DEPLOY_HOST:-89.167.92.75}"
REMOTE_USER="${DEPLOY_USER:-deploy}"
REMOTE="${REMOTE_USER}@${REMOTE_HOST}"

REMOTE_APP_DIR="${DEPLOY_APP_DIR:-/home/deploy/saas-monorepo}"
REMOTE_ARCHIVE="${DEPLOY_ARCHIVE:-/home/deploy/saas-workspace.tgz}"
REMOTE_WEB_ROOT="${DEPLOY_WEB_ROOT:-/var/www/vesipolku.jrwl.io}"
REMOTE_SERVICE="${DEPLOY_SERVICE:-jrwl-api}"
REMOTE_NGINX_SITE_PATH="${DEPLOY_NGINX_SITE_PATH:-/etc/nginx/sites-available/apps.jrwl.io}"
DEPLOY_API_BASE_URL="${DEPLOY_API_BASE_URL:-https://api.jrwl.io}"
KEEP_BACKUPS="${DEPLOY_KEEP_BACKUPS:-3}"

TMP_ARCHIVE="$(mktemp /tmp/saas-workspace.XXXXXX.tgz)"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[deploy] Missing required command: $1" >&2
    exit 1
  fi
}

cleanup() {
  rm -f "${TMP_ARCHIVE}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

require_cmd tar
require_cmd ssh
require_cmd scp
require_cmd curl

require_header() {
  local header_name="$1"
  local response_headers="$2"
  if ! grep -qi "^${header_name}:" <<<"${response_headers}"; then
    echo "[deploy] Missing required frontend header: ${header_name}" >&2
    exit 1
  fi
}

echo "[deploy] Packaging workspace from ${REPO_ROOT}"
tar -czf "${TMP_ARCHIVE}" \
  --exclude=.git \
  --exclude=node_modules \
  --exclude=apps/*/node_modules \
  --exclude=packages/*/node_modules \
  --exclude=playwright-report \
  --exclude=test-results \
  --exclude=output \
  --exclude=.cursor \
  --exclude=.claude \
  --exclude=.playwright-cli \
  -C "${REPO_ROOT}" .

echo "[deploy] Testing SSH connection to ${REMOTE}"
ssh -o StrictHostKeyChecking=accept-new "${REMOTE}" "echo '[remote] Connected to ' \"\$(hostname)\""

echo "[deploy] Checking remote passwordless sudo"
if ! ssh "${REMOTE}" "SYSTEMCTL_PATH=\$(command -v systemctl) && NGINX_PATH=\$(command -v nginx) && sudo -n -l \${SYSTEMCTL_PATH} stop ${REMOTE_SERVICE} >/dev/null 2>&1 && sudo -n -l \${SYSTEMCTL_PATH} restart ${REMOTE_SERVICE} >/dev/null 2>&1 && sudo -n -l \${SYSTEMCTL_PATH} reload nginx >/dev/null 2>&1 && sudo -n -l \${NGINX_PATH} -t >/dev/null 2>&1"; then
  cat >&2 <<'EOF'
[deploy] Remote sudo preflight failed.
[deploy] Configure passwordless sudo for the deploy user before running prod deploys.
[deploy] See docs/PROD_DEPLOY.md for the sudoers example and setup steps.
EOF
  exit 1
fi

echo "[deploy] Uploading archive"
scp "${TMP_ARCHIVE}" "${REMOTE}:${REMOTE_ARCHIVE}"

echo "[deploy] Running remote deploy"
ssh "${REMOTE}" "bash -s" <<EOF
set -euo pipefail

APP_DIR="${REMOTE_APP_DIR}"
ARCHIVE="${REMOTE_ARCHIVE}"
WEB_ROOT="${REMOTE_WEB_ROOT}"
SERVICE="${REMOTE_SERVICE}"
NGINX_SITE_PATH="${REMOTE_NGINX_SITE_PATH}"
API_BASE_URL="${DEPLOY_API_BASE_URL}"
KEEP_BACKUPS="${KEEP_BACKUPS}"
PRESERVE_ENV_PATH="/home/deploy/.deploy-cache/api.env"
NGINX_TEMPLATE_PATH="\${APP_DIR}/infra/nginx/apps.jrwl.io.conf"

echo "[remote] Using app dir: \${APP_DIR}"

timestamp=\$(date +%Y%m%d-%H%M%S)

if [ -f "\${APP_DIR}/apps/api/.env" ]; then
  mkdir -p /home/deploy/.deploy-cache
  cp "\${APP_DIR}/apps/api/.env" "\${PRESERVE_ENV_PATH}"
fi

sudo -n systemctl stop "\${SERVICE}" || true

rm -rf "\${APP_DIR}.new"
mkdir -p "\${APP_DIR}.new"
tar -xzf "\${ARCHIVE}" -C "\${APP_DIR}.new"

if [ -f "\${PRESERVE_ENV_PATH}" ]; then
  mkdir -p "\${APP_DIR}.new/apps/api"
  cp "\${PRESERVE_ENV_PATH}" "\${APP_DIR}.new/apps/api/.env"
  chmod 600 "\${APP_DIR}.new/apps/api/.env"
fi

if [ -d "\${APP_DIR}" ]; then
  mv "\${APP_DIR}" "\${APP_DIR}.backup-\${timestamp}"
fi
mv "\${APP_DIR}.new" "\${APP_DIR}"

cd "\${APP_DIR}"

AUTH_EDGE_RATE_LIMIT_SECRET_VALUE=""
if [ -f "\${APP_DIR}/apps/api/.env" ]; then
  AUTH_EDGE_RATE_LIMIT_SECRET_VALUE="$(grep '^AUTH_EDGE_RATE_LIMIT_SECRET=' "\${APP_DIR}/apps/api/.env" | head -n 1 | cut -d '=' -f 2- || true)"
  AUTH_EDGE_RATE_LIMIT_SECRET_VALUE="\${AUTH_EDGE_RATE_LIMIT_SECRET_VALUE%$'\r'}"
  AUTH_EDGE_RATE_LIMIT_SECRET_VALUE="\${AUTH_EDGE_RATE_LIMIT_SECRET_VALUE#\"}"
  AUTH_EDGE_RATE_LIMIT_SECRET_VALUE="\${AUTH_EDGE_RATE_LIMIT_SECRET_VALUE%\"}"
fi

if [ -z "\${AUTH_EDGE_RATE_LIMIT_SECRET_VALUE}" ]; then
  echo "[remote] AUTH_EDGE_RATE_LIMIT_SECRET missing from apps/api/.env"
  exit 1
fi

if [ ! -f "\${NGINX_TEMPLATE_PATH}" ]; then
  echo "[remote] Missing nginx template: \${NGINX_TEMPLATE_PATH}"
  exit 1
fi

mkdir -p /home/deploy/.deploy-cache
if [ -f "\${NGINX_SITE_PATH}" ]; then
  cp "\${NGINX_SITE_PATH}" "/home/deploy/.deploy-cache/apps.jrwl.io.before-\${timestamp}.conf"
fi

AUTH_EDGE_RATE_LIMIT_SECRET_ESCAPED="$(printf '%s' "\${AUTH_EDGE_RATE_LIMIT_SECRET_VALUE}" | sed -e 's/[\/&]/\\&/g')"
sed "s|__AUTH_EDGE_RATE_LIMIT_SECRET__|\${AUTH_EDGE_RATE_LIMIT_SECRET_ESCAPED}|g" "\${NGINX_TEMPLATE_PATH}" > "\${NGINX_SITE_PATH}"

pnpm install --frozen-lockfile
pnpm build:api
VITE_API_BASE_URL="\${API_BASE_URL}" pnpm --filter ./apps/web build
pnpm --filter ./apps/api prisma:migrate:deploy

mkdir -p "\${WEB_ROOT}"
rm -rf "\${WEB_ROOT}"/*
cp -r "\${APP_DIR}/apps/web/dist/." "\${WEB_ROOT}/"

sudo -n systemctl restart "\${SERVICE}"
sudo -n nginx -t
sudo -n systemctl reload nginx

for attempt in {1..30}; do
  if curl -fsS http://127.0.0.1:4000/health/live >/dev/null 2>&1; then
    break
  fi
  if [ "\${attempt}" -eq 30 ]; then
    echo "[remote] API failed health check after restart"
    sudo -n systemctl status "\${SERVICE}" --no-pager || true
    exit 1
  fi
  sleep 2
done

curl -fsS http://127.0.0.1:4000/health >/dev/null
curl -fsSI "\${API_BASE_URL}/health/live" >/dev/null

if [ "\${KEEP_BACKUPS}" -gt 0 ]; then
  mapfile -t backups < <(ls -1dt "\${APP_DIR}.backup-"* 2>/dev/null || true)
  if [ "\${#backups[@]}" -gt "\${KEEP_BACKUPS}" ]; then
    for ((i=KEEP_BACKUPS; i<\${#backups[@]}; i++)); do
      rm -rf "\${backups[\$i]}"
    done
  fi
fi

rm -f "\${ARCHIVE}"
echo "[remote] Deploy completed successfully"
EOF

echo "[deploy] Verifying public endpoints"
FRONTEND_HEADERS="$(curl -fsSI "https://vesipolku.jrwl.io")"
require_header "Content-Security-Policy" "${FRONTEND_HEADERS}"
require_header "Cross-Origin-Opener-Policy" "${FRONTEND_HEADERS}"
require_header "Referrer-Policy" "${FRONTEND_HEADERS}"
require_header "Strict-Transport-Security" "${FRONTEND_HEADERS}"
require_header "X-Content-Type-Options" "${FRONTEND_HEADERS}"
require_header "X-Frame-Options" "${FRONTEND_HEADERS}"
curl -fsSI "https://api.jrwl.io/health/live" >/dev/null

echo "[deploy] Done"
