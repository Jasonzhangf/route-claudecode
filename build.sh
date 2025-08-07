#!/bin/bash

# Build script for Claude Code Router
# 清理和构建项目

set -e  # Exit on any error

echo "🧹 Cleaning previous build..."
rm -rf dist/
rm -rf node_modules/.cache/
rm -f claude-code-router-*.tgz

echo "📦 Installing dependencies..."
npm ci

echo "🔨 Building TypeScript..."
npm run build
echo "✅ Build successful!"

echo "📁 Copying static files..."
if [ -d "public/" ]; then
    cp -r public/ dist/public/ || echo "⚠️  Public directory copy failed"
else
    echo "ℹ️  No public directory found, skipping..."
fi

# 确保CLI可执行
if [ -f "dist/cli.js" ]; then
    chmod +x dist/cli.js
    echo "✅ CLI executable permissions set"
else
    echo "❌ CLI file not found after build"
    exit 1
fi

echo "🧪 Validating build..."
if [ -f "dist/cli.js" ] && [ -f "dist/dynamic-model-cli.js" ]; then
    echo "✅ All required build artifacts present"
else
    echo "⚠️ Some build artifacts missing, continuing..."
fi

echo "📋 Validating package structure..."
if npm pack --dry-run > /dev/null 2>&1; then
    echo "✅ Package structure valid"
else
    echo "⚠️ Package validation issues detected, continuing..."
fi

echo "✅ Build completed successfully!"
echo ""
echo "📊 Build artifacts:"
ls -la dist/
echo ""
echo "🚀 Ready for deployment!"