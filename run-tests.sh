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
SERVER_LOG="/tmp/tmtrack-ui-server-${PORT}.log"
python3 -c "
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import sys
server = ThreadingHTTPServer((sys.argv[1], int(sys.argv[2])), SimpleHTTPRequestHandler)
server.serve_forever()
" "127.0.0.1" "${PORT}" > "${SERVER_LOG}" 2>&1 &
SERVER_PID=$!

cleanup() {
    if [[ -n "${SERVER_PID}" ]]; then
        kill "${SERVER_PID}" 2>/dev/null || true
    fi
    rm -f "${SERVER_LOG}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait for server to be responsive
READY=false
for i in $(seq 1 30); do
    if curl -s "http://127.0.0.1:${PORT}/" > /dev/null 2>&1; then
        READY=true
        break
    fi
    sleep 0.1
done

if [[ "${READY}" != "true" ]]; then
    echo "Error: Local web server failed to start on port ${PORT}." >&2
    cat "${SERVER_LOG}" >&2 || true
    exit 1
fi

# Resolve Cypress execution method:
# 1. If local ./node_modules/.bin/cypress exists, use it.
# 2. Otherwise, if npm is available in PATH, install dependencies via npm install.
# 3. If npm/local cypress is not available, use official Docker Cypress container.
CYPRESS_CMD=""

if [[ -x "./node_modules/.bin/cypress" ]]; then
    CYPRESS_CMD="./node_modules/.bin/cypress"
elif command -v npm >/dev/null 2>&1; then
    echo "=== Installing Cypress dependencies via npm ==="
    npm install --no-audit --no-fund --quiet
    if [[ -x "./node_modules/.bin/cypress" ]]; then
        CYPRESS_CMD="./node_modules/.bin/cypress"
    fi
fi

if [[ -n "${CYPRESS_CMD}" ]]; then
    echo "Local web server ready. Executing Cypress tests locally..."
    "${CYPRESS_CMD}" run --browser electron --headless --config baseUrl="http://localhost:${PORT}" "$@"
else
    # Determine Docker command (with passwordless sudo fallback if needed)
    DOCKER_BIN="$(command -v docker || true)"
    if [[ -z "${DOCKER_BIN}" ]]; then
        echo "Error: Neither local Cypress/npm nor Docker is available to execute tests." >&2
        exit 1
    fi

    DOCKER_RUN="${DOCKER_BIN}"
    if ! "${DOCKER_BIN}" ps >/dev/null 2>&1; then
        if command -v sudo >/dev/null 2>&1 && sudo -n "${DOCKER_BIN}" ps >/dev/null 2>&1; then
            DOCKER_RUN="sudo -n ${DOCKER_BIN}"
        fi
    fi

    CYPRESS_IMAGE="cypress/included:13.13.1"
    echo "Local Cypress binary not found. Executing tests using Docker (${CYPRESS_IMAGE})..."
    ${DOCKER_RUN} run --rm \
        --network host \
        --user "$(id -u):$(id -g)" \
        -v "${SCRIPT_DIR}:/e2e" \
        -w /e2e \
        "${CYPRESS_IMAGE}" \
        --browser electron \
        --headless \
        --config baseUrl="http://localhost:${PORT}" \
        "$@"
fi
