#!/bin/sh
# 在线备份 SQLite 数据库到 deploy/backups/，默认保留最近 14 份
# 用法：sh deploy/backup.sh  （可加入 crontab，例如每天 3 点：0 3 * * * sh /opt/studentos/deploy/backup.sh）
set -eu
cd "$(dirname "$0")"
STAMP=$(date +%Y%m%d-%H%M%S)
KEEP=${KEEP:-14}
mkdir -p backups

docker compose exec -T app node --disable-warning=ExperimentalWarning -e "
const { DatabaseSync } = require('node:sqlite');
require('node:fs').mkdirSync('/data/backups', { recursive: true });
new DatabaseSync('/data/studentos.db').exec(\"VACUUM INTO '/data/backups/studentos-$STAMP.db'\");
"
docker compose cp "app:/data/backups/studentos-$STAMP.db" "backups/studentos-$STAMP.db"
docker compose exec -T app rm "/data/backups/studentos-$STAMP.db"

ls -1t backups/studentos-*.db | tail -n "+$((KEEP + 1))" | xargs -r rm --
echo "已备份：deploy/backups/studentos-$STAMP.db"
