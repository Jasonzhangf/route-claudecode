#!/bin/bash

# Deployment Script with Rollback Capabilities
# Implements comprehensive deployment pipeline

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOYMENT_LOG="${PROJECT_ROOT}/deployment.log"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

log() {
    echo "[${TIMESTAMP}] $1" | tee -a "${DEPLOYMENT_LOG}"
}

handle_error() {
    log "❌ Deployment failed at line $1 with exit code $2"
    log "📝 Check deployment log: ${DEPLOYMENT_LOG}"
    exit $2
}

trap 'handle_error ${LINENO} $?' ERR

main() {
    log "🚀 Starting Deployment Pipeline"
    log "📁 Project Root: ${PROJECT_ROOT}"
    
    cd "${PROJECT_ROOT}"
    npx tsx scripts/deployment-pipeline.ts deploy
    
    log "✅ Deployment pipeline completed"
}

main "$@"