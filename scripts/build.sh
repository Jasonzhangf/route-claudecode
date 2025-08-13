#!/bin/bash

# Zero-Fallback Build Script
# Implements explicit error handling with no silent failures

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_LOG="${PROJECT_ROOT}/build.log"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Logging function
log() {
    echo "[${TIMESTAMP}] $1" | tee -a "${BUILD_LOG}"
}

# Error handling function
handle_error() {
    log "❌ Build failed at line $1 with exit code $2"
    log "📝 Check build log: ${BUILD_LOG}"
    exit $2
}

trap 'handle_error ${LINENO} $?' ERR

# Main build process
main() {
    log "🚀 Starting Zero-Fallback Build Process"
    log "📁 Project Root: ${PROJECT_ROOT}"
    
    # Execute TypeScript build system
    cd "${PROJECT_ROOT}"
    npx tsx scripts/build-system.ts build
    
    log "✅ Build completed successfully"
}

main "$@"