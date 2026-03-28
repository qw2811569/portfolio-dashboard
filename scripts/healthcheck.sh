#!/bin/bash

# Local Development Health Check
# Usage: ./scripts/healthcheck.sh

URL="http://127.0.0.1:3002"
API_URL="${URL}/api/brain?action=all"
TIMEOUT=5
LOG_FILE=".tmp/vercel-dev.log"
RESOURCE_FAILURES=0

check_resource() {
    local label="$1"
    local resource_url="$2"
    local required="${3:-optional}"
    local silent_success="${4:-false}"
    local resource_status

    resource_status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout "$TIMEOUT" "$resource_url" || true)
    if [[ "$resource_status" == "200" ]]; then
        if [[ "$silent_success" != "true" ]]; then
            echo "✅ Frontend resource OK: ${label}"
        fi
        return 0
    fi

    if [[ "$required" == "required" ]]; then
        echo "❌ Frontend resource check failed: ${label} (${resource_url}) status=${resource_status:-unknown}"
        RESOURCE_FAILURES=$((RESOURCE_FAILURES + 1))
    else
        echo "⚠️  Frontend resource warning: ${label} (${resource_url}) status=${resource_status:-unknown}"
    fi

    return 1
}

echo "🔍 Checking local development server..."
echo "URL: ${URL}"
echo ""

# Check if server is running and homepage responds
ROOT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout "$TIMEOUT" "$URL" || true)
if [[ "$ROOT_STATUS" == "200" ]]; then
    echo "✅ Server is running at ${URL}"
    echo ""

    ROOT_HTML=$(curl -s --connect-timeout "$TIMEOUT" "$URL" || true)

    # Check Vite status from vercel dev log
    RECENT_VITE_LOG=$(tail -n 80 "$LOG_FILE" 2>/dev/null || true)
    if [[ -z "$RECENT_VITE_LOG" ]]; then
        echo "⚠️  Vite log file not found or empty at ${LOG_FILE}"
    elif echo "$RECENT_VITE_LOG" | grep -Eiq "\\[vite\\].*(hmr update|page reload|ready|Local:)"; then
        echo "✅ Vite frontend log signal detected."
    else
        echo "⚠️  Vite frontend might not be ready. Check ${LOG_FILE} for details."
    fi

    LATEST_APP_VITE_EVENT=$(echo "$RECENT_VITE_LOG" | grep "/src/App.jsx" | tail -n 1 || true)
    if [[ -n "$LATEST_APP_VITE_EVENT" ]] && echo "$LATEST_APP_VITE_EVENT" | grep -Eiq "Could not Fast Refresh|hmr invalidate"; then
        echo "⚠️  Latest App.jsx Vite event shows HMR invalidation. Frontend is serving, but Fast Refresh may be degraded."
    elif [[ -n "$LATEST_APP_VITE_EVENT" ]] && echo "$LATEST_APP_VITE_EVENT" | grep -Eiq "hmr update|page reload"; then
        echo "✅ Latest App.jsx Vite event is healthy: Fast Refresh signal looks normal."
    fi

    echo ""

    echo "Frontend resources:"
    check_resource "index.html" "$URL/index.html" required
    check_resource "Vite client" "$URL/@vite/client" required
    check_resource "App entry" "$URL/src/main.jsx" required

    if [[ -n "$ROOT_HTML" ]]; then
        while IFS= read -r asset_path; do
            [[ -z "$asset_path" ]] && continue
            check_resource "linked asset ${asset_path}" "${URL}${asset_path}" optional true
        done < <(
            printf '%s' "$ROOT_HTML" \
                | grep -Eo '(src|href)="[^"]+"' \
                | cut -d '"' -f 2 \
                | grep -E '^/(src/|@vite/client|assets/|node_modules/)' \
                | sed '/^\/src\/main\.jsx$/d;/^\/@vite\/client$/d' \
                | sort -u
        )
    fi

    if [[ "$RESOURCE_FAILURES" -gt 0 ]]; then
        echo ""
        echo "❌ Critical frontend resource checks failed: ${RESOURCE_FAILURES}"
        exit 1
    fi

    echo ""

    # Get response time
    RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$URL")
    echo "Response time: ${RESPONSE_TIME} s"
    
    # Check if API is available with a real route
    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout "$TIMEOUT" "$API_URL" || true)
    if [[ "$API_STATUS" == "200" ]]; then
        echo "✅ API is available"
    else
        echo "⚠️  API check failed at ${API_URL} (status: ${API_STATUS:-unknown})"
    fi

    echo "ℹ️  For frontend runtime validation, run: npm run smoke:ui"
    
    exit 0
else
    echo "❌ Server is NOT running at ${URL}"
    echo ""
    echo "To start the server, run:"
    echo "  vercel dev"
    echo ""
    exit 1
fi
