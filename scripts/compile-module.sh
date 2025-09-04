#!/bin/bash

# 单模块编译脚本 - RCC v4.0 Module Isolation System
# 用法: ./compile-module.sh <module-name>

set -e  # 遇到错误立即退出

MODULE_NAME=$1
if [ -z "$MODULE_NAME" ]; then
  echo "❌ 错误: 请指定模块名称"
  echo "用法: ./compile-module.sh <module-name>"
  echo "可用模块: config, router"
  exit 1
fi

MODULE_PATH="src/modules/$MODULE_NAME"
OUTPUT_PATH="compiled-modules/$MODULE_NAME"

if [ ! -d "$MODULE_PATH" ]; then
  echo "❌ 错误: 模块 '$MODULE_NAME' 不存在"
  echo "路径: $MODULE_PATH"
  exit 1
fi

echo "🔧 开始编译模块: $MODULE_NAME"
echo "📂 源码路径: $MODULE_PATH"
echo "📁 输出路径: $OUTPUT_PATH"

# 清理旧的编译产物
echo "🧹 清理旧的编译产物..."
rm -rf "$OUTPUT_PATH"
mkdir -p "$OUTPUT_PATH"

# 检查模块tsconfig.json是否存在
if [ ! -f "$MODULE_PATH/tsconfig.json" ]; then
  echo "❌ 错误: 找不到 $MODULE_PATH/tsconfig.json"
  exit 1
fi

# 编译TypeScript
echo "📦 编译TypeScript..."
cd "$MODULE_PATH"
npx tsc
COMPILE_EXIT_CODE=$?

# 返回项目根目录
cd "../../.."

if [ $COMPILE_EXIT_CODE -ne 0 ]; then
  echo "❌ TypeScript编译失败，退出码: $COMPILE_EXIT_CODE"
  exit 1
fi

# 验证编译产物
echo "✅ 验证编译产物..."
if [ ! -f "$OUTPUT_PATH/index.js" ]; then
  echo "❌ 编译失败: 未找到编译产物 $OUTPUT_PATH/index.js"
  echo "📁 实际生成的文件:"
  ls -la "$OUTPUT_PATH/" 2>/dev/null || echo "输出目录不存在"
  exit 1
fi

if [ ! -f "$OUTPUT_PATH/index.d.ts" ]; then
  echo "❌ 编译失败: 未找到声明文件 $OUTPUT_PATH/index.d.ts"
  exit 1
fi

# 生成模块元信息
echo "📝 生成模块元信息..."
BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
SOURCE_HASH=$(find "$MODULE_PATH/src" -name '*.ts' -type f -exec md5sum {} \; 2>/dev/null | md5sum | cut -d' ' -f1)

cat > "$OUTPUT_PATH/package.json" << EOF
{
  "name": "@rcc/$MODULE_NAME",
  "version": "4.1.0",
  "description": "RCC v4.0 $MODULE_NAME Module - Compiled Module",
  "main": "index.js",
  "types": "index.d.ts",
  "private": true,
  "buildInfo": {
    "buildTime": "$BUILD_TIME",
    "sourceHash": "$SOURCE_HASH",
    "compiler": "TypeScript $(npx tsc --version | cut -d' ' -f2)"
  },
  "rcc": {
    "moduleType": "$MODULE_NAME",
    "isolationLevel": "complete",
    "apiVersion": "4.1.0"
  }
}
EOF

# 显示编译结果
echo ""
echo "✅ 模块 '$MODULE_NAME' 编译成功!"
echo "📦 编译产物:"
echo "  - JavaScript: $OUTPUT_PATH/index.js"
echo "  - 声明文件: $OUTPUT_PATH/index.d.ts" 
echo "  - 模块信息: $OUTPUT_PATH/package.json"
echo "🕒 编译时间: $BUILD_TIME"
echo "🔐 源码哈希: $SOURCE_HASH"

# 显示文件大小
JS_SIZE=$(wc -c < "$OUTPUT_PATH/index.js" | xargs)
DTS_SIZE=$(wc -c < "$OUTPUT_PATH/index.d.ts" | xargs)
echo "📊 文件大小:"
echo "  - index.js: ${JS_SIZE} bytes"
echo "  - index.d.ts: ${DTS_SIZE} bytes"

echo ""
echo "🎉 模块 '$MODULE_NAME' 编译完成!"