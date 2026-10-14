#!/usr/bin/env bash
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

PORT=8000
# If port 8000 is occupied, find an open port between 8001 and 8099
if ss -tulpn 2>/dev/null | grep -q ":${PORT} "; then
    for p in $(seq 8001 8099); do
        if ! ss -tulpn 2>/dev/null | grep -q ":${p} "; then
            PORT=$p
            break
        fi
    done
fi

echo "=== TMTrack UI Local Test Runner ==="
echo "Serving UI on http://127.0.0.1:${PORT}"

# Start Python ThreadingHTTPServer in background
python3 -c "
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import sys
server = ThreadingHTTPServer(('127.0.0.1', ${PORT}), SimpleHTTPRequestHandler)
server.serve_forever()
" > /dev/null 2>&1 &
SERVER_PID=$!

cleanup() {
    if [[ -n "${SERVER_PID}" ]]; then
        kill "${SERVER_PID}" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

# Wait for server to be responsive
for i in $(seq 1 30); do
    if curl -s "http://127.0.0.1:${PORT}/" > /dev/null 2>&1; then
        break
    fi
    sleep 0.1
done

echo "Local web server ready. Executing Cypress tests..."
./node_modules/.bin/cypress run --browser electron --headless --config baseUrl="http://localhost:${PORT}" "$@"
