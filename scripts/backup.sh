#!/bin/bash
# Snapshots data/os.db into data/backups/, keeping the last 14 days.
set -euo pipefail

cd "$(dirname "$0")/.."
DB="${OS_DB_PATH:-data/os.db}"
DEST="data/backups"
KEEP=14

[ -f "$DB" ] || { echo "[lifeos] no database at $DB yet"; exit 0; }
mkdir -p "$DEST"

STAMP="$(date +%Y-%m-%d)"
OUT="$DEST/os-$STAMP.db"

# .backup is safe to run while the server has the database open.
sqlite3 "$DB" ".backup '$OUT'"
echo "[lifeos] wrote $OUT ($(du -h "$OUT" | cut -f1))"

ls -1t "$DEST"/os-*.db 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -f "$old"
  echo "[lifeos] pruned $old"
done
