#!/bin/bash

# Add JQJsonHandler imports to files that need them

set -e

PROJECT_ROOT="/Users/fanzhang/Documents/github/route-claudecode/workspace/main-development"
cd "$PROJECT_ROOT"

echo "🔧 添加JQJsonHandler导入到需要的文件..."

# 需要添加导入的文件列表
FILES_NEED_IMPORT=(
    "src/modules/pipeline-modules/server-compatibility/adaptive-compatibility.ts"
    "src/modules/pipeline-modules/server-compatibility/debug-integration.ts"
    "src/modules/pipeline-modules/server-compatibility/enhanced-compatibility.ts"
    "src/modules/pipeline-modules/server-compatibility/lmstudio-compatibility.ts"
    "src/modules/pipeline-modules/server-compatibility/passthrough-compatibility.ts"
    "src/modules/pipeline-modules/server-compatibility/qwen-compatibility.ts"
    "src/modules/pipeline-modules/server/openai-server.ts"
    "src/modules/providers/anthropic-protocol-handler.ts"
    "src/modules/providers/config-loader.ts"
    "src/modules/providers/monitoring/alert-manager.ts"
    "src/modules/providers/monitoring/metrics-collector.ts"
    "src/modules/providers/monitoring/monitoring-dashboard.ts"
    "src/modules/transformers/transformer-factory.ts"
)

PROCESSED=0

for file in "${FILES_NEED_IMPORT[@]}"; do
    if [[ -f "$file" ]]; then
        echo "🔧 处理文件: $(basename "$file")"
        
        # 检查是否已经有JQJsonHandler导入
        if grep -q "import.*JQJsonHandler" "$file"; then
            echo "   ✅ 已有导入，跳过"
            continue
        fi
        
        # 计算相对路径深度
        DEPTH=$(echo "$file" | grep -o "/" | wc -l)
        RELATIVE_PATH=""
        for ((i=2; i<$DEPTH; i++)); do
            RELATIVE_PATH="../$RELATIVE_PATH"
        done
        
        # 查找最后一个import行
        LAST_IMPORT_LINE=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)
        
        if [[ -n "$LAST_IMPORT_LINE" ]]; then
            # 在最后一个import之后添加
            sed -i.bak "${LAST_IMPORT_LINE}a\\
import { JQJsonHandler } from '${RELATIVE_PATH}utils/jq-json-handler';" "$file"
            rm -f "$file.bak"
            echo "   ✅ 导入已添加: ${RELATIVE_PATH}utils/jq-json-handler"
            PROCESSED=$((PROCESSED + 1))
        else
            echo "   ⚠️ 未找到import行，跳过"
        fi
    else
        echo "⚠️ 文件不存在: $file"
    fi
done

echo ""
echo "📋 导入添加完成："
echo "   - 处理文件数: $PROCESSED"
echo ""
echo "🎉 JQJsonHandler导入添加任务完成!"