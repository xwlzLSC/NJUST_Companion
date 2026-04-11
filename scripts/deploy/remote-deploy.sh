#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$APP_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "node 未安装，无法继续部署" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm 未安装，无法继续部署" >&2
  exit 1
fi

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
fi

set -a
if [ -f .env ]; then
  # shellcheck disable=SC1091
  . ./.env
fi
set +a

mkdir -p "${APP_STORAGE_DIR:-storage}" logs

npm ci --omit=dev

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
