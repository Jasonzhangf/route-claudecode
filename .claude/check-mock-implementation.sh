#!/bin/bash

# Enhanced Mock Implementation Checker Script
# This script checks if a file contains mock implementations that should be real implementations
# and provides detailed statistics

echo "🔍 Checking for mock implementations..."

# Count occurrences of mock-related keywords
MOCK_COUNT=$(grep -r "mock" --include="*.ts" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git . 2>/dev/null | wc -l | tr -d ' ')
FAKE_COUNT=$(grep -r "fake" --include="*.ts" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git . 2>/dev/null | wc -l | tr -d ' ')
STUB_COUNT=$(grep -r "stub" --include="*.ts" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git . 2>/dev/null | wc -l | tr -d ' ')

TOTAL_MOCKS=$((MOCK_COUNT + FAKE_COUNT + STUB_COUNT))

if [ $TOTAL_MOCKS -gt 0 ]; then
    echo "❌ WARNING: Potential mock implementations found!"
    echo "   - Mock implementations: $MOCK_COUNT"
    echo "   - Fake implementations: $FAKE_COUNT"
    echo "   - Stub implementations: $STUB_COUNT"
    echo "   - Total issues: $TOTAL_MOCKS"
    echo ""
    echo "Files with mock implementations:"
    grep -r "mock\|fake\|stub" --include="*.ts" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git . 2>/dev/null | head -10
    if [ $TOTAL_MOCKS -gt 10 ]; then
        echo "... and $((TOTAL_MOCKS - 10)) more files"
    fi
    echo ""
    echo "Please replace mock implementations with real implementations."
    echo "If this is intentional, you can proceed, but ensure it's properly documented."
    exit 1
else
    echo "✅ No mock implementations found."
fi