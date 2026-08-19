#!/bin/bash
# Manages the LifeOS LaunchAgent: the server starts at login and stays up.
#
#   scripts/agent.sh install | uninstall | restart | status | logs
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.sepehr.lifeos"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
TARGET="gui/$(id -u)/$LABEL"
BACKUP_LABEL="com.sepehr.lifeos.backup"
BACKUP_PLIST="$HOME/Library/LaunchAgents/$BACKUP_LABEL.plist"
BACKUP_TARGET="gui/$(id -u)/$BACKUP_LABEL"
PORT="${PORT:-3000}"

install_agent() {
  local node_bin node_dir
  node_bin="$(command -v node || true)"
  if [ -z "$node_bin" ]; then
    echo "node is not on PATH — install Node first." >&2
    exit 1
  fi
  node_dir="$(cd "$(dirname "$node_bin")" && pwd)"

  mkdir -p "$APP_DIR/logs" "$HOME/Library/LaunchAgents"

  cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$APP_DIR/scripts/serve.sh</string>
  </array>
  <key>WorkingDirectory</key><string>$APP_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$node_dir:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>NODE_ENV</key><string>production</string>
    <key>PORT</key><string>$PORT</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$APP_DIR/logs/server.log</string>
  <key>StandardErrorPath</key><string>$APP_DIR/logs/server.log</string>
</dict>
</plist>
PLIST

  cat > "$BACKUP_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$BACKUP_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$APP_DIR/scripts/backup.sh</string>
  </array>
  <key>WorkingDirectory</key><string>$APP_DIR</string>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>3</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$APP_DIR/logs/backup.log</string>
  <key>StandardErrorPath</key><string>$APP_DIR/logs/backup.log</string>
</dict>
</plist>
PLIST

  launchctl bootout "$TARGET" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  launchctl bootout "$BACKUP_TARGET" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$BACKUP_PLIST"
  echo "[lifeos] installed $PLIST"
  echo "[lifeos] nightly backup at 03:00 → data/backups/"
  wait_for_port
}

uninstall_agent() {
  launchctl bootout "$TARGET" 2>/dev/null || true
  launchctl bootout "$BACKUP_TARGET" 2>/dev/null || true
  rm -f "$PLIST" "$BACKUP_PLIST"
  echo "[lifeos] agent removed. The app no longer starts at login."
}

restart_agent() {
  if [ ! -f "$PLIST" ]; then
    echo "[lifeos] agent not installed — run: npm run app:install" >&2
    exit 1
  fi
  # The nightly backup job arrived later than the server job; make sure it is loaded.
  if [ -f "$BACKUP_PLIST" ] && ! launchctl print "$BACKUP_TARGET" >/dev/null 2>&1; then
    launchctl bootstrap "gui/$(id -u)" "$BACKUP_PLIST" 2>/dev/null || true
  fi
  launchctl kickstart -k "$TARGET"
  wait_for_port
}

wait_for_port() {
  for _ in $(seq 1 40); do
    if curl -sf -o /dev/null "http://127.0.0.1:$PORT/login"; then
      echo "[lifeos] running at http://localhost:$PORT"
      return 0
    fi
    sleep 0.5
  done
  echo "[lifeos] server did not answer on port $PORT — check logs/server.log" >&2
  exit 1
}

case "${1:-status}" in
  install) install_agent ;;
  uninstall) uninstall_agent ;;
  restart) restart_agent ;;
  status)
    if launchctl print "$TARGET" >/dev/null 2>&1; then
      echo "[lifeos] agent loaded"
      curl -sf -o /dev/null "http://127.0.0.1:$PORT/login" \
        && echo "[lifeos] responding on http://localhost:$PORT" \
        || echo "[lifeos] not responding on port $PORT"
    else
      echo "[lifeos] agent not installed"
    fi
    ;;
  logs) tail -n 60 -f "$APP_DIR/logs/server.log" ;;
  *) echo "usage: $0 {install|uninstall|restart|status|logs}" >&2; exit 1 ;;
esac
