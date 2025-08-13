#!/bin/bash

# Zero-Fallback Validation Script
# Validates dependencies and project structure

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VALIDATION_LOG="${PROJECT_ROOT}/validation.log"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

log() {
    echo "[${TIMESTAMP}] $1" | tee -a "${VALIDATION_LOG}"
}

handle_error() {
    log "❌ Validation failed at line $1 with exit code $2"
    exit $2
}

trap 'handle_error ${LINENO} $?' ERR

main() {
    log "🔍 Starting Zero-Fallback Validation Process"
    log "📁 Project Root: ${PROJECT_ROOT}"
    
    cd "${PROJECT_ROOT}"
    npx tsx scripts/dependency-validator.ts
    
    log "✅ Validation completed successfully"
}

main "$@"