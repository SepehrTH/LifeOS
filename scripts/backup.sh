#!/bin/bash
# Snapshots data/os.db into data/backups/, keeping the last 14 days.
#
# Writes are buffered in a write-ahead log (data/os.db-wal) and only folded into os.db at a
# checkpoint, so a copy that misses the WAL silently loses everything since the last one.
# This checkpoints first, writes a fully materialised copy, and then *verifies* the copy is
# as current as the live database before keeping it.
set -euo pipefail

cd "$(dirname "$0")/.."
DB="${OS_DB_PATH:-data/os.db}"
DEST="data/backups"
KEEP=14

[ -f "$DB" ] || { echo "[lifeos] no database at $DB yet"; exit 0; }
mkdir -p "$DEST"

STAMP="$(date +%Y-%m-%d)"
OUT="$DEST/os-$STAMP.db"
TMP="$OUT.partial"
rm -f "$TMP"

# Latest event in a database, as a comparable string. Empty if it cannot be read.
newest() {
  sqlite3 "$1" "SELECT COALESCE(MAX(at), '') FROM item_events;" 2>/dev/null || true
}

LIVE="$(newest "$DB")"

# Fold the WAL into the main file, then take a clean copy of the whole database.
sqlite3 "$DB" "PRAGMA wal_checkpoint(TRUNCATE);" >/dev/null 2>&1 || true
sqlite3 "$DB" "VACUUM INTO '$TMP';"

COPY="$(newest "$TMP")"
if [ "$COPY" != "$LIVE" ]; then
  echo "[lifeos] BACKUP REJECTED — copy is stale (live: ${LIVE:-?}, copy: ${COPY:-?})" >&2
  mv "$TMP" "$OUT.rejected"
  exit 1
fi

mv "$TMP" "$OUT"
echo "[lifeos] wrote $OUT ($(du -h "$OUT" | cut -f1), current to ${LIVE:-empty})"

ls -1t "$DEST"/os-*.db 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -f "$old"
  echo "[lifeos] pruned $old"
done
