#!/bin/bash

# Replace JSON.stringify with JQJsonHandler throughout RCC v4.0 project
# Batch processing approach

set -e

PROJECT_ROOT="/Users/fanzhang/Documents/github/route-claudecode/workspace/main-development"
cd "$PROJECT_ROOT"

echo "🔄 开始批量替换项目中的所有JSON.stringify调用..."

# 使用直接替换方式处理每个文件
function process_file() {
    local file="$1"
    local depth="$2"
    
    if [[ ! -f "$file" ]]; then
        return
    fi
    
    echo "🔧 处理文件: $(basename "$file")"
    
    # 构建相对路径
    local relative_path=""
    for ((i=2; i<$depth; i++)); do
        relative_path="../$relative_path"
    done
    
    # 检查是否需要添加import
    if ! grep -q "import.*JQJsonHandler" "$file"; then
        echo "   📝 添加JQJsonHandler导入"
        
        # 使用Python来安全地添加import
        python3 -c "
import sys
import re

with open('$file', 'r') as f:
    content = f.read()

# 查找最后一个import行
import_lines = []
lines = content.split('\n')
for i, line in enumerate(lines):
    if line.strip().startswith('import '):
        import_lines.append(i)

if import_lines:
    # 在最后一个import后添加
    last_import_idx = max(import_lines)
    new_import = \"import { JQJsonHandler } from '${relative_path}utils/jq-json-handler';\"
    lines.insert(last_import_idx + 1, new_import)
    
    with open('$file', 'w') as f:
        f.write('\n'.join(lines))
    print('   ✅ 导入已添加')
else:
    print('   ⚠️ 未找到import行')
"
    fi
    
    # 替换JSON.stringify
    echo "   🔄 替换JSON.stringify调用"
    sed -i.bak 's/JSON\.stringify(/JQJsonHandler.stringifyJson(/g' "$file"
    rm -f "$file.bak"
    
    echo "   ✅ 完成: $(basename "$file")"
}

# 主要处理的文件列表
declare -A FILES_TO_PROCESS
FILES_TO_PROCESS[src/config/unified-config-manager.ts]=3
FILES_TO_PROCESS[src/client/index.ts]=2
FILES_TO_PROCESS[src/client/session.ts]=2
FILES_TO_PROCESS[src/modules/pipeline-modules/server-compatibility/enhanced-compatibility.ts]=5
FILES_TO_PROCESS[src/modules/pipeline-modules/server-compatibility/lmstudio-compatibility.ts]=5
FILES_TO_PROCESS[src/modules/pipeline-modules/server-compatibility/debug-integration.ts]=5
FILES_TO_PROCESS[src/modules/pipeline-modules/server-compatibility/passthrough-compatibility.ts]=5
FILES_TO_PROCESS[src/modules/pipeline-modules/server-compatibility/qwen-compatibility.ts]=5
FILES_TO_PROCESS[src/modules/pipeline-modules/server-compatibility/adaptive-compatibility.ts]=5
FILES_TO_PROCESS[src/modules/transformers/transformer-factory.ts]=3
FILES_TO_PROCESS[src/modules/providers/openai-protocol-handler.ts]=3
FILES_TO_PROCESS[src/modules/pipeline-modules/server/openai-server.ts]=4
FILES_TO_PROCESS[src/modules/providers/config-loader.ts]=3
FILES_TO_PROCESS[src/modules/providers/anthropic-protocol-handler.ts]=3
FILES_TO_PROCESS[src/modules/providers/monitoring/metrics-collector.ts]=4
FILES_TO_PROCESS[src/modules/providers/monitoring/monitoring-dashboard.ts]=4
FILES_TO_PROCESS[src/modules/providers/monitoring/alert-manager.ts]=4

PROCESSED_COUNT=0

for file in "${!FILES_TO_PROCESS[@]}"; do
    depth="${FILES_TO_PROCESS[$file]}"
    process_file "$file" "$depth"
    PROCESSED_COUNT=$((PROCESSED_COUNT + 1))
done

echo ""
echo "📋 批量处理完成："
echo "   - 处理文件数: $PROCESSED_COUNT"

# 验证结果
echo ""
echo "🔍 验证剩余的JSON.stringify调用..."
REMAINING=$(grep -r "JSON\.stringify" src/ --include="*.ts" 2>/dev/null | grep -v "jq-json-handler\.ts" | grep -v "test\.ts" | wc -l || echo "0")
echo "   - 剩余调用数: $REMAINING"

echo ""
echo "🎉 JSON.stringify批量替换任务完成!"