#!/bin/bash

cd /Users/fanzhang/Documents/github/route-claudecode/workspace/main-development

echo "🔍 Running TypeScript compilation check..."
echo "Working directory: $(pwd)"

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/

# Run TypeScript compilation
echo "🏗️ Running TypeScript compilation..."
npx tsc --noEmit --pretty 2>&1 | head -20

echo "✅ Quick compilation check completed"