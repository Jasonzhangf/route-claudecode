#!/bin/bash

# RCC v4.0 Build and Install Script
# 标准构建和全局安装流程

set -e

echo "🔧 Starting RCC v4.0 build and install process..."

# Step 1: 清理previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -f *.tgz

# Step 2: 安装依赖
echo "📦 Installing dependencies..."
npm install

# Step 3: TypeScript编译
echo "🏗️ Compiling TypeScript..."
npm run build

# Step 4: 验证编译输出
echo "✅ Verifying build output..."
if [ ! -f "dist/cli.js" ]; then
  echo "❌ Build failed: dist/cli.js not found"
  exit 1
fi

echo "📋 Build output files:"
ls -la dist/

# Step 5: 创建npm包
echo "📦 Creating npm package..."
npm pack

# Step 6: 查找生成的包文件
PACKAGE_FILE=$(ls -1 *.tgz | head -n 1)
if [ -z "$PACKAGE_FILE" ]; then
  echo "❌ Failed to create package file"
  exit 1
fi

echo "📦 Created package: $PACKAGE_FILE"

# Step 7: 卸载旧版本
echo "🗑️ Uninstalling previous version..."
npm uninstall -g route-claude-code || true

# Step 8: 全局安装
echo "🌐 Installing globally..."
npm install -g "$PACKAGE_FILE"

# Step 9: 验证安装
echo "✅ Verifying installation..."
if command -v rcc4 >/dev/null 2>&1; then
  echo "🎉 Installation successful!"
  echo "📋 Version information:"
  rcc4 --version
  echo "💡 Usage: rcc4 --help"
else
  echo "❌ Installation failed: rcc4 command not found"
  exit 1
fi

echo "✅ RCC v4.0 build and install completed successfully!"