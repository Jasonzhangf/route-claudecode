#!/bin/bash

# Zero-Fallback Publish Script
# Requires explicit user confirmation for publishing

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_LOG="${PROJECT_ROOT}/publish.log"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

log() {
    echo "[${TIMESTAMP}] $1" | tee -a "${BUILD_LOG}"
}

handle_error() {
    log "❌ Publish failed at line $1 with exit code $2"
    exit $2
}

trap 'handle_error ${LINENO} $?' ERR

main() {
    log "📤 Starting Zero-Fallback Publish Process"
    log "📁 Project Root: ${PROJECT_ROOT}"
    
    cd "${PROJECT_ROOT}"
    npx tsx scripts/build-system.ts publish
    
    log "✅ Publish completed successfully"
}

main "$@"