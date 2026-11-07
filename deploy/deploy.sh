#!/bin/sh
# 部署到 jessylab 服务器：./deploy/deploy.sh [宣传片目录]
# 需要能用 SSH 登录 root@8.216.48.63（本机用 ~/.ssh/dev-jyotish-deploy_ed25519）
set -eu
HOST=${DEPLOY_HOST:-root@8.216.48.63}
KEY=${DEPLOY_KEY:-$HOME/.ssh/dev-jyotish-deploy_ed25519}
PROMO=${1:-}
SSH="ssh -i $KEY -o BatchMode=yes"
cd "$(dirname "$0")/.."
NODE_ENV=development npx tsc --noEmit
NODE_ENV=development npx vite build >/dev/null
$SSH "$HOST" 'mkdir -p /opt/santemple/promo'
rsync -az --delete -e "$SSH" dist/ "$HOST:/opt/santemple/dist/"
rsync -az --delete -e "$SSH" server/ "$HOST:/opt/santemple/server/"
rsync -az -e "$SSH" package.json package-lock.json "$HOST:/opt/santemple/"
if [ -n "$PROMO" ]; then rsync -az -e "$SSH" "$PROMO/promo.mp4" "$PROMO/cover.jpg" "$PROMO/cover-3x4.jpg" "$HOST:/opt/santemple/promo/"; fi
$SSH "$HOST" 'cd /opt/santemple && npm ci --omit=dev --no-audit --no-fund --loglevel=error && systemctl restart santemple && sleep 1 && curl -fsS http://127.0.0.1:4318/healthz'
echo
curl -fsS -o /dev/null -w "https://santemple.jessylab.cc/ %{http_code}\n" https://santemple.jessylab.cc/
