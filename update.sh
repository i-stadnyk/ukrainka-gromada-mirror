#!/usr/bin/env bash
# Оновлює дзеркало й пушить на GitHub, лише якщо щось змінилося.
# Запускається cron-ом на машині з українським IP (сайт громади закритий для закордонних адрес):
#   2,32 * * * * /home/igor/apps/ukrainka-gromada-mirror/update.sh >> /home/igor/apps/ukrainka-gromada-mirror/.update.log 2>&1
set -uo pipefail
cd "$(dirname "$0")"
export PATH="/home/igor/.nvm/versions/node/v20.20.0/bin:$PATH"
export GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=20"

exec 9>.update.lock
flock -n 9 || exit 0

git pull -q --rebase || { echo "$(date -Is) git pull не вдався"; exit 1; }
node mirror.mjs || { echo "$(date -Is) помилка збирання"; exit 1; }
git add -A posts.json meta.json img
if git diff --cached --quiet; then exit 0; fi
git commit -q -m "Оновлення дзеркала" && git push -q && echo "$(date -Is) оновлено"
