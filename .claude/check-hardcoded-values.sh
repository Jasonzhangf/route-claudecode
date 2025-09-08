#!/bin/bash

# Enhanced Hard-coded Value Checker Script
# This script checks for hard-coded values that should be moved to constants
# and provides detailed statistics

echo "🔍 Checking for hard-coded values..."

# Skip check if we're in the constants directory
if [[ $(pwd) == *src/constants* ]]; then
    echo "ℹ️  In constants directory, skipping hard-coded value check."
    exit 0
fi

# Find hard-coded values (numbers with 4+ digits) outside the constants directory
HARDCODED_LINES=$(grep -r "[0-9]\{4,\}" --include="*.ts" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git . 2>/dev/null | grep -v "src/constants" | head -10)
HARDCODED_COUNT=$(echo "$HARDCODED_LINES" | grep -v "^$" | wc -l | tr -d ' ')

if [ $HARDCODED_COUNT -gt 0 ]; then
    echo "❌ WARNING: Hard-coded values found!"
    echo "   - Total hard-coded values detected: $HARDCODED_COUNT"
    echo ""
    echo "Files with hard-coded values:"
    echo "$HARDCODED_LINES"
    if [ $HARDCODED_COUNT -gt 10 ]; then
        echo "... and $((HARDCODED_COUNT - 10)) more files"
    fi
    echo ""
    echo "Please move these values to the src/constants directory."
    exit 1
else
    echo "✅ No hard-coded values found."
fi