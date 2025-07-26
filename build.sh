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

echo "🧪 Running tests..."
npm test

echo "📋 Checking package..."
npm pack --dry-run

echo "✅ Build completed successfully!"
echo ""
echo "📊 Build artifacts:"
ls -la dist/
echo ""
echo "🚀 Ready for deployment!"