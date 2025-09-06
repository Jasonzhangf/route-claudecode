#!/bin/bash

# 全量编译脚本 - RCC v4.0 Module Isolation System
# 编译所有可用模块

set -e

echo "🚀 开始全量编译所有模块..."
echo "⏰ 开始时间: $(date)"

# 重组后的模块列表 (transformers已移入pipeline-modules, debug已拆分为logging和error-handler)
MODULES=("config" "router" "api" "client" "core" "interfaces" "server" "tools" "logging" "error-handler")
FAILED_MODULES=()
SUCCESS_COUNT=0
TOTAL_TIME_START=$(date +%s)

for MODULE in "${MODULES[@]}"; do
  echo ""
  echo "=========================================="
  echo "📦 编译模块: $MODULE"
  echo "=========================================="
  
  MODULE_TIME_START=$(date +%s)
  
  if ./scripts/compile-module.sh "$MODULE"; then
    MODULE_TIME_END=$(date +%s)
    MODULE_DURATION=$((MODULE_TIME_END - MODULE_TIME_START))
    echo "✅ $MODULE 编译成功 (耗时: ${MODULE_DURATION}s)"
    ((SUCCESS_COUNT++))
  else
    MODULE_TIME_END=$(date +%s)
    MODULE_DURATION=$((MODULE_TIME_END - MODULE_TIME_START))
    echo "❌ $MODULE 编译失败 (耗时: ${MODULE_DURATION}s)"
    FAILED_MODULES+=("$MODULE")
  fi
done

TOTAL_TIME_END=$(date +%s)
TOTAL_DURATION=$((TOTAL_TIME_END - TOTAL_TIME_START))

echo ""
echo "=========================================="
echo "📊 编译总结"
echo "=========================================="
echo "✅ 成功: $SUCCESS_COUNT/${#MODULES[@]} 个模块"
echo "❌ 失败: ${#FAILED_MODULES[@]} 个模块"
echo "⏱️  总耗时: ${TOTAL_DURATION}s"

if [ ${#FAILED_MODULES[@]} -gt 0 ]; then
  echo ""
  echo "❌ 失败的模块:"
  for FAILED_MODULE in "${FAILED_MODULES[@]}"; do
    echo "  - $FAILED_MODULE"
  done
  exit 1
fi

# 生成模块API网关
echo ""
echo "🔧 生成模块API网关..."
mkdir -p "node_modules/@rcc"
cat > "node_modules/@rcc/index.js" << 'EOF'
/**
 * RCC v4.0 模块API网关
 * 
 * ⚠️ 此文件为编译生成，请勿手动修改
 * 
 * 提供统一的模块访问接口，隐藏具体实现细节
 */

// 导出所有编译后的模块
module.exports = {
  // 配置管理模块
  config: require('./config'),
  
  // 路由器模块  
  router: require('./router'),
  
  // 未来扩展：
  // pipeline: require('./pipeline'),    // 待重构
  // scheduler: require('./scheduler'),  // 待重构
};

// 模块信息
module.exports.__moduleInfo = {
  version: '4.1.0',
  buildTime: new Date().toISOString(),
  isolationLevel: 'complete',
  availableModules: Object.keys(module.exports).filter(k => k !== '__moduleInfo')
};
EOF

cat > "node_modules/@rcc/index.d.ts" << 'EOF'
/**
 * RCC v4.0 模块API网关类型声明
 * 
 * ⚠️ 此文件为编译生成，请勿手动修改
 */

// 导入各模块类型
import * as ConfigModule from './config';
import * as RouterModule from './router';

// 导出统一接口
export const config: typeof ConfigModule;
export const router: typeof RouterModule;

// 模块信息接口
export interface ModuleInfo {
  version: string;
  buildTime: string;
  isolationLevel: string;
  availableModules: string[];
}

export const __moduleInfo: ModuleInfo;
EOF

echo "✅ 模块API网关生成完成"
echo "  - JavaScript: node_modules/@rcc/index.js"  
echo "  - 声明文件: node_modules/@rcc/index.d.ts"

# 清理临时的compiled-modules目录
echo ""
echo "🧹 清理临时的compiled-modules目录..."
rm -rf "compiled-modules"

echo ""
echo "🎉 全量编译完成!"
echo "📁 编译产物位置: node_modules/@rcc/"
echo "🔍 可用模块: ${MODULES[*]}"
echo "⚠️  注意: pipeline模块需要重构后才能迁移"