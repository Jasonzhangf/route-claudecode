#!/bin/bash

# Rollback Script
# Implements deployment rollback capabilities

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROLLBACK_LOG="${PROJECT_ROOT}/rollback.log"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

log() {
    echo "[${TIMESTAMP}] $1" | tee -a "${ROLLBACK_LOG}"
}

handle_error() {
    log "❌ Rollback failed at line $1 with exit code $2"
    log "📝 Check rollback log: ${ROLLBACK_LOG}"
    exit $2
}

trap 'handle_error ${LINENO} $?' ERR

main() {
    log "🔄 Starting Rollback Process"
    log "📁 Project Root: ${PROJECT_ROOT}"
    
    cd "${PROJECT_ROOT}"
    npx tsx scripts/deployment-pipeline.ts rollback
    
    log "✅ Rollback completed"
}

main "$@"