#!/bin/bash

echo "🔍 Checking TypeScript compilation after import path fixes..."
echo "============================================================"

cd /Users/fanzhang/Documents/github/route-claudecode/workspace/main-development

# Run TypeScript compilation check
echo "🏗️ Running TypeScript compilation..."
npx tsc --noEmit --pretty 2>&1 | head -30

echo ""
echo "📊 Checking for remaining 'types/src' import issues..."
grep -r "from.*types/src'[^/]" src/ 2>/dev/null | head -10

echo ""
echo "✅ Import path fix check completed"