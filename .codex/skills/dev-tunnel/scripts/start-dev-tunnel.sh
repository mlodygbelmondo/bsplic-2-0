#!/usr/bin/env bash
set -u

PORT="${1:-6767}"
APP_PATH="${2:-/dev/jackpot}"

if [[ "$APP_PATH" != /* ]]; then
  APP_PATH="/$APP_PATH"
fi

if ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  cd "$ROOT" || exit 1
else
  ROOT="$(pwd)"
fi

STATE_DIR="$ROOT/.codex/tmp/dev-tunnel"
mkdir -p "$STATE_DIR"

VITE_LOG="$STATE_DIR/vite-$PORT.log"
VITE_PID_FILE="$STATE_DIR/vite-$PORT.pid"
CLOUDFLARED_LOG="$STATE_DIR/cloudflared-$PORT.log"
CLOUDFLARED_PID_FILE="$STATE_DIR/cloudflared-$PORT.pid"
URL_FILE="$STATE_DIR/cloudflare-$PORT.url"

is_listening() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 || nc -z 127.0.0.1 "$port" >/dev/null 2>&1
}

pid_is_running() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1
}

wait_for_port() {
  local port="$1"
  local max_wait="${2:-60}"
  local i
  for ((i = 1; i <= max_wait; i++)); do
    if is_listening "$port"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

find_lan_ip() {
  local ip=""
  if command -v ipconfig >/dev/null 2>&1; then
    ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
    if [[ -z "$ip" ]]; then
      ip="$(ipconfig getifaddr en1 2>/dev/null || true)"
    fi
  fi
  if [[ -z "$ip" ]] && command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  fi
  printf '%s' "$ip"
}

ensure_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then
    return 0
  fi

  if [[ "$(uname -s)" == "Darwin" ]] && command -v brew >/dev/null 2>&1; then
    echo "cloudflared not found. Installing with Homebrew..."
    brew install cloudflared || return 1
    command -v cloudflared >/dev/null 2>&1
    return $?
  fi

  echo "cloudflared is not installed and could not be installed automatically."
  echo "Install it first: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/"
  return 1
}

validate_url() {
  local url="$1"
  local target="${url}${APP_PATH}"
  local code
  code="$(curl -sS -L --max-time 10 -o "$STATE_DIR/check-$PORT.html" -w '%{http_code}' "$target" 2>/dev/null || true)"
  [[ "$code" =~ ^(200|204|301|302|307|308)$ ]]
}

discover_existing_cloudflare_urls() {
  local metrics_ports
  local metrics_port
  metrics_ports="$(lsof -nP -a -c cloudflared -iTCP -sTCP:LISTEN 2>/dev/null | awk '/127\.0\.0\.1:/ { sub(/^.*:/, "", $9); print $9 }' | sort -u)"

  for metrics_port in $metrics_ports; do
    curl -sS --max-time 2 "http://127.0.0.1:${metrics_port}/metrics" 2>/dev/null \
      | awk -F'userHostname="' '/cloudflared_tunnel_user_hostnames_counts/ { split($2, parts, "\""); print parts[1] }'
  done
}

echo "Project: $ROOT"
echo "Port: $PORT"
echo "Path: $APP_PATH"

if is_listening "$PORT"; then
  echo "A service is already listening on port $PORT. Reusing it."
else
  echo "Starting Vite dev server on port $PORT..."
  nohup npm run dev -- --host 0.0.0.0 --port "$PORT" >"$VITE_LOG" 2>&1 &
  echo "$!" >"$VITE_PID_FILE"

  if ! wait_for_port "$PORT" 75; then
    echo "Dev server did not start on port $PORT."
    echo "Vite log: $VITE_LOG"
    tail -40 "$VITE_LOG" 2>/dev/null || true
    exit 1
  fi
fi

if ! ensure_cloudflared; then
  exit 1
fi

TUNNEL_URL=""
VALIDATED="no"

for DISCOVERED_URL in $(discover_existing_cloudflare_urls); do
  if [[ "$DISCOVERED_URL" == https://*.trycloudflare.com ]] && validate_url "$DISCOVERED_URL"; then
    TUNNEL_URL="$DISCOVERED_URL"
    VALIDATED="yes"
    echo "Reusing existing Cloudflare tunnel from cloudflared metrics."
    break
  fi
done

EXISTING_URL=""
if [[ -f "$URL_FILE" ]]; then
  EXISTING_URL="$(cat "$URL_FILE" 2>/dev/null || true)"
fi

EXISTING_PID=""
if [[ -f "$CLOUDFLARED_PID_FILE" ]]; then
  EXISTING_PID="$(cat "$CLOUDFLARED_PID_FILE" 2>/dev/null || true)"
fi

if [[ -z "$TUNNEL_URL" ]] && pid_is_running "$EXISTING_PID" && [[ "$EXISTING_URL" == https://*.trycloudflare.com ]]; then
  if validate_url "$EXISTING_URL"; then
    TUNNEL_URL="$EXISTING_URL"
    VALIDATED="yes"
    echo "Reusing existing Cloudflare tunnel."
  else
    echo "Existing managed tunnel did not validate. Starting a fresh one."
    kill "$EXISTING_PID" >/dev/null 2>&1 || true
    TUNNEL_URL=""
  fi
else
  if [[ -z "$TUNNEL_URL" ]]; then
    TUNNEL_URL=""
  fi
fi

validate_until_ready() {
  local url="$1"
  local max_wait="${2:-45}"
  local i
  for ((i = 1; i <= max_wait; i++)); do
    if validate_url "$url"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

start_cloudflared_once() {
  local attempt="$1"
  local pid
  local i
  local protocol="${DEV_TUNNEL_PROTOCOL:-}"
  local cmd=(cloudflared tunnel --url "http://localhost:$PORT" --http-host-header "localhost:$PORT" --loglevel info)

  if [[ -n "$protocol" ]]; then
    cmd+=(--protocol "$protocol")
  fi

  : >"$CLOUDFLARED_LOG"
  echo "Starting Cloudflare Quick Tunnel (attempt $attempt)..."
  nohup "${cmd[@]}" >"$CLOUDFLARED_LOG" 2>&1 &
  pid="$!"
  echo "$pid" >"$CLOUDFLARED_PID_FILE"

  TUNNEL_URL=""
  for ((i = 1; i <= 45; i++)); do
    TUNNEL_URL="$(grep -Eo 'https://[-[:alnum:]]+\.trycloudflare\.com' "$CLOUDFLARED_LOG" | tail -1 || true)"
    if [[ -n "$TUNNEL_URL" ]]; then
      break
    fi
    if ! pid_is_running "$pid"; then
      break
    fi
    sleep 1
  done

  if [[ -z "$TUNNEL_URL" ]]; then
    echo "Cloudflare tunnel URL was not emitted in time on attempt $attempt."
    kill "$pid" >/dev/null 2>&1 || true
    return 1
  fi

  echo "$TUNNEL_URL" >"$URL_FILE"

  if ! pid_is_running "$pid"; then
    echo "cloudflared exited after emitting ${TUNNEL_URL} on attempt $attempt."
    return 1
  fi

  if validate_until_ready "$TUNNEL_URL" 60; then
    return 0
  fi

  echo "Cloudflare URL did not validate on attempt $attempt: ${TUNNEL_URL}${APP_PATH}"
  kill "$pid" >/dev/null 2>&1 || true
  return 1
}

if [[ -n "$TUNNEL_URL" && "$VALIDATED" != "yes" ]]; then
  if validate_until_ready "$TUNNEL_URL" 15; then
    VALIDATED="yes"
  else
    EXISTING_PID="$(cat "$CLOUDFLARED_PID_FILE" 2>/dev/null || true)"
    kill "$EXISTING_PID" >/dev/null 2>&1 || true
    TUNNEL_URL=""
  fi
fi

if [[ -z "$TUNNEL_URL" ]]; then
  for ((attempt = 1; attempt <= 3; attempt++)); do
    if start_cloudflared_once "$attempt"; then
      VALIDATED="yes"
      break
    fi
    sleep 2
  done
fi

if [[ -z "$TUNNEL_URL" ]]; then
  echo "Cloudflare tunnel could not be created."
  echo "cloudflared log: $CLOUDFLARED_LOG"
  tail -80 "$CLOUDFLARED_LOG" 2>/dev/null || true
  exit 1
fi

if [[ "$VALIDATED" != "yes" ]] && validate_url "$TUNNEL_URL"; then
  VALIDATED="yes"
fi

LAN_IP="$(find_lan_ip)"

echo
echo "Cloudflare URL: ${TUNNEL_URL}${APP_PATH}"
if [[ -n "$LAN_IP" ]]; then
  echo "LAN URL: http://${LAN_IP}:${PORT}${APP_PATH}"
fi
echo "Local URL: http://localhost:${PORT}${APP_PATH}"
echo "Validated: $VALIDATED"
echo "Vite log: $VITE_LOG"
echo "cloudflared log: $CLOUDFLARED_LOG"

if [[ "$VALIDATED" != "yes" ]]; then
  echo
  echo "The tunnel URL was created but did not validate yet. It may still become ready; check the cloudflared log above."
  exit 2
fi
